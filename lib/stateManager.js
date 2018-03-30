const Buffer = require('safe-buffer').Buffer
const Trie = require('merkle-patricia-tree/secure.js')
const RedisDb = require('./redis-db.js')
const common = require('ethereum-common')
const async = require('async')
const Account = require('ethereumjs-account')
const fakeBlockchain = require('./fakeBlockChain.js')
const Cache = require('./cache.js')
const utils = require('ethereumjs-util')
const BN = utils.BN
const rlp = utils.rlp

const log = require('loglevel').getLogger('stateManager')
log.setLevel('silent')

module.exports = StateManager

function StateManager (opts) {
  var self = this

  var trie = opts.trie
  if (!trie) {
    trie = new Trie(trie)
  }

  var db = opts.db
  if (!db) {
    db = new RedisDb()
  }

  var blockchain = opts.blockchain
  if (!blockchain) {
    blockchain = fakeBlockchain
  }

  self.blockchain = blockchain
  self.trie = trie
  self._storageTries = {} // the storage trie cache
  self.cache = new Cache(trie, db)
  self.touched = []
  self.db = db
}

var proto = StateManager.prototype


proto.quitDb = function () {
  var self = this
  self.db.quit()
}

// TODO: keep track of "modified" accounts
// the modified accounts list will be used for checking the post state
// and also for recalculating the state root



// also need for db to support proto.getRaw and proto.putRaw
// for use from ethereumjs-account https://github.com/ethereumjs/ethereumjs-account/blob/master/index.js#L34-L57
/*
trie.putRaw(this.codeHash, code, function (err) {
    cb(err, self.codeHash)
  })
*/


// gets the account from the cache, or triggers a lookup and stores
// the result in the cache
proto.getAccount = function (address, cb) {
  this.cache.getOrLoad(address, cb)
}

// checks if an account exists
proto.exists = function (address, cb) {
  this.cache.getOrLoad(address, function (err, account) {
    cb(err, account.exists)
  })
}


proto.getAccountFromDb = function (address, cb) {
  const self = this

  function callback(err, result) {
    log.trace('getAccountFromDb err:', err)
    log.trace('getAccountFromDb result:', result)
    const accountObj = new Account(result)
    log.trace('returning accountObj:', accountObj)
    cb(err, accountObj)
  }
  self.db.getAccount(address, callback)
}



proto.setAccount = function (address, account, cb) {
  log.trace('stateManager.js setAccount')
  const self = this

  let addressStr = address
  if (typeof addressStr !== 'string') {
    addressStr = address.toString('hex')
  }

  function callback() {
    log.trace('stateManager.setAccount. proxying to _putAccount..')
    // temporarily proxy all calls to the trie-using function
    const seralizedAccount = account.serialize().toString('hex')
    self.db.setAccount(addressStr, seralizedAccount, callback)
  }

  self._putAccount(addressStr, account, cb)
}





// saves the account
proto._putAccount = function (address, account, cb) {
  var self = this
  log.trace('stateManager.js _putAccount address:', address)
  if (typeof address !== 'string') {
    throw(new Error('stateManager.js _putAccount called with address not string!'))
  }

  // TODO: dont save newly created accounts that have no balance
  // if (toAccount.balance.toString('hex') === '00') {
  // if they have money or a non-zero nonce or code, then write to tree

  self.cache.put(address, account)
  self.touched.push(address)
  // self.trie.put(addressHex, account.serialize(), cb)
  cb()
}

proto.getAccountBalance = function (address, cb) {
  var self = this
  self.getAccount(address, function (err, account) {
    if (err) {
      return cb(err)
    }
    cb(null, account.balance)
  })
}

proto.putAccountBalance = function (address, balance, cb) {
  var self = this

  self.getAccount(address, function (err, account) {
    if (err) {
      return cb(err)
    }

    if ((new BN(balance)).isZero() && !account.exists) {
      return cb(null)
    }

    account.balance = balance
    self._putAccount(address, account, cb)
  })
}


// TODO: cache account code (currently it is never cached)

// sets the contract code on the account
proto.putContractCode = function (address, value, cb) {
  var self = this
  self.setAccountCode(address, value, cb)

}


proto.getContractCode = function (address, cb) {
  //cb(err, codeBuf, comp)
  log.trace('stateManager.js getContractCode proxying to getAccountCode..')
  var self = this
  function callback (err, result) {
    if (err) {
      log.trace('stateManager.js getContractCode err:', err)
      cb(err, null)
      return
    }
    const codeBuf = Buffer.from(result, 'hex')
    cb(null, codeBuf, false)
  }
  self.getAccountCode(address, callback)
}

proto.setAccountCode = function (address, code, cb) {
  log.trace('stateManager.js setAccountCode address:', address)
  const self = this
  self.db.setAccountCode(address, code, cb)
}


proto.getAccountCode = function (address, cb) {
  log.trace('stateManager.js getAccountCode address:', address)
  const self = this
  if (typeof address !== 'string') {
    address = address.toString('hex')
  }
  self.db.getAccountCode(address, cb)
}





// getContractStorage and putContractStorage are used by SLOAD and SSTORE from opFns.js

proto.getContractStorage = function (address, key, cb) {
  log.trace('stateManager.js getContractStorage address:', address)
  log.trace('stateManager.js getContractStorage key:', key)
  const self = this
  self.getAccountStorage(address, key, cb)
}


proto.putContractStorage = function (address, key, value, cb) {
  log.trace('stateManager.js putContractStorage address:', address)
  log.trace('stateManager.js putContractStorage key:', key)
  log.trace('stateManager.js putContractStorage value:', value)
  const self = this

  self.setAccountStorage(address, key, value, cb)
}



proto.commitContracts = function (cb) {
  log.trace('stateManager.js commitContracts..')
  var self = this
  async.each(Object.keys(self._storageTries), function (address, callback) {
    callback()
    /*
    var trie = self._storageTries[address]
    delete self._storageTries[address]
    // TODO: this is broken on the block level; all the contracts get written to
    // disk redardless of whether or not the block is valid
    if (trie.isCheckpoint) {
      trie.commit(cb)
    } else {
      cb()
    }
    */
  }, cb)
}


proto.revertContracts = function () {
  var self = this
  self._storageTries = {}
}



proto.getAllAccountStorage = function (cb) {
  var self = this
  log.trace('stateManager.getAllAccountStorage')
  self.db.getAllAccountStorage(cb)
}



proto.getAccountStorage = function (address, key, cb) {
  log.trace('stateManager.getAccountStorage. address:', address)
  var self = this

  let addressStr = address
  if (typeof addressStr !== 'string') {
    addressStr = address.toString('hex')
  }

  self.db.getAccountStorage(addressStr, key, cb)
}


proto.setAccountStorage = function (address, key, value, cb) {
  log.trace('stateManager.setAccountStorage. address:', address)
  var self = this

  let addressStr = address
  if (typeof addressStr !== 'string') {
    addressStr = address.toString('hex')
  }

  // format input
  //var encodedValue = rlp.encode(value)
  //log.trace('stateManager.js setAccountStorage encodedValue:', encodedValue)

  // TODO: storage values are not rlp encoded because we aren't using a trie yet.

  self.touched.push(addressStr)
  self.db.setAccountStorage(addressStr, key, value, cb)
}



/*
proto.dumpStorage = function (address, cb) {
  var self = this
  self._getStorageTrie(address, function (err, trie) {
    if (err) {
      return cb(err)
    }
    var storage = {}
    var stream = trie.createReadStream()
    stream.on('data', function (val) {
      storage[val.key.toString('hex')] = val.value.toString('hex')
    })
    stream.on('end', function () {
      cb(storage)
    })
  })
}
*/



//
// blockchain
//
proto.getBlockHash = function (number, cb) {
  var self = this
  self.blockchain.getBlock(number, function (err, block) {
    if (err) {
      return cb(err)
    }
    var blockHash = block.hash()
    cb(null, blockHash)
  })
}

//
// revision history
//
proto.checkpoint = function () {
  var self = this
  self.trie.checkpoint()
  self.cache.checkpoint()
}

proto.commit = function (cb) {
  var self = this
  // setup trie checkpointing
  self.trie.commit(function () {
    // setup cache checkpointing
    self.cache.commit()
    cb()
  })
}

proto.revert = function (cb) {
  var self = this
  // setup trie checkpointing
  self.trie.revert()
  // setup cache checkpointing
  self.cache.revert()
  cb()
}

//
// cache stuff
//
proto.getStateRoot = function (cb) {
  var self = this
  self.cacheFlush(function (err) {
    if (err) {
      return cb(err)
    }
    var stateRoot = self.trie.root
    cb(null, stateRoot)
  })
}

/**
 * @param {Set} address
 * @param {cb} function
 */
proto.warmCache = function (addresses, cb) {
  this.cache.warm(addresses, cb)
}

proto.hasGenesisState = function (cb) {
  const root = common.genesisStateRoot.v
  log.trace('stateManager.js hasGenesisState root:', root)
  this.trie.checkRoot(root, cb)
}

proto.generateCanonicalGenesis = function (cb) {
  var self = this

  this.hasGenesisState(function (err, genesis) {
    if (!genesis && !err) {
      self.generateGenesis(common.genesisState, cb)
    } else {
      cb(err)
    }
  })
}

proto.generateGenesis = function (initState, cb) {
  var self = this
  var addresses = Object.keys(initState)
  async.eachSeries(addresses, function (address, done) {
    var account = new Account()
    account.balance = new BN(initState[address]).toArrayLike(Buffer)
    address = Buffer.from(address, 'hex')
    self.trie.put(address, account.serialize(), done)
  }, cb)
}

proto.accountIsEmpty = function (address, cb) {
  var self = this
  self.getAccount(address, function (err, account) {
    if (err) {
      return cb(err)
    }

    cb(null, account.nonce.toString('hex') === '' && account.balance.toString('hex') === '' && account.codeHash.toString('hex') === utils.SHA3_NULL_S)
  })
}
