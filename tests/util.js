const async = require('async')
const utils = require('ethereumjs-util')
const BN = utils.BN
const rlp = utils.rlp
const Account = require('ethereumjs-account')
const Transaction = require('ethereumjs-tx')
const Block = require('ethereumjs-block')

const log = require('loglevel').getLogger('test-util')
log.setLevel('silent')

const EMPTY_TRIE_ROOT = Buffer.from(utils.SHA3_RLP).toString('hex')

exports.dumpState = function (state, cb) {
  function readAccounts (state) {
    return new Promise((resolve, reject) => {
      let accounts = []
      var rs = state.createReadStream()
      rs.on('data', function (data) {
        let account = new Account(data.value)
        account.address = data.key
        accounts.push(account)
      })

      rs.on('end', function () {
        resolve(accounts)
      })
    })
  }

  function readStorage (state, account) {
    return new Promise((resolve, reject) => {
      let storage = {}
      let storageTrie = state.copy()
      storageTrie.root = account.stateRoot
      let storageRS = storageTrie.createReadStream()

      storageRS.on('data', function (data) {
        storage[data.key.toString('hex')] = data.value.toString('hex')
      })

      storageRS.on('end', function () {
        resolve(storage)
      })
    })
  }

  readAccounts(state).then(function (accounts) {
    async.mapSeries(accounts, function (account, cb) {
      readStorage(state, account).then((storage) => {
        account.storage = storage
        cb(null, account)
      })
    },
    function (err, results) {
      if (err) {
        cb(err, null)
      }
      for (let i = 0; i < results.length; i++) {
        log.trace('SHA3\'d address: ' + results[i].address.toString('hex'))
        log.trace('\tstate root: ' + results[i].stateRoot.toString('hex'))
        log.trace('\tstorage: ')
        for (let storageKey in results[i].storage) {
          log.trace('\t\t' + storageKey + ': ' + results[i].storage[storageKey])
        }
        log.trace('\tnonce: ' + (new BN(results[i].nonce)).toString())
        log.trace('\tbalance: ' + (new BN(results[i].balance)).toString())
      }
      return cb()
    })
  })
}

var format = exports.format = function (a, toZero, isHex) {
  if (a === '') {
    return Buffer.alloc(0)
  }

  if (a.slice && a.slice(0, 2) === '0x') {
    a = a.slice(2)
    if (a.length % 2) a = '0' + a
    a = Buffer.from(a, 'hex')
  } else if (!isHex) {
    a = Buffer.from(new BN(a).toArray())
  } else {
    if (a.length % 2) a = '0' + a
    a = Buffer.from(a, 'hex')
  }

  if (toZero && a.toString('hex') === '') {
    a = Buffer.from([0])
  }

  return a
}

/**
 * makeTx using JSON from tests repo
 * @param {[type]} txData the transaction object from tests repo
 * @return {Object}        object that will be passed to VM.runTx function
 */
exports.makeTx = function (txData) {
  var tx = new Transaction()
  tx.nonce = format(txData.nonce)
  tx.gasPrice = format(txData.gasPrice)
  tx.gasLimit = format(txData.gasLimit)
  tx.to = format(txData.to, true, true)
  tx.value = format(txData.value)
  tx.data = format(txData.data, false, true) // slice off 0x
  if (txData.secretKey) {
    var privKey = format(txData.secretKey, false, true)
    tx.sign(privKey)
  } else {
    tx.v = Buffer.from(txData.v.slice(2), 'hex')
    tx.r = Buffer.from(txData.r.slice(2), 'hex')
    tx.s = Buffer.from(txData.s.slice(2), 'hex')
  }
  return tx
}

//exports.verifyPostConditions = function (state, testData, t, cb) {
exports.verifyPostConditions = function (stateManager, testData, t, cb) {
  log.trace('util.js verifyPostConditions')
  var hashedAccounts = {}
  var keyMap = {}

  log.trace('util.js verifyPostConditions:', testData)

  /*
  for (var key in testData) {
    var hash = utils.sha3(Buffer.from(utils.stripHexPrefix(key), 'hex')).toString('hex')
    hashedAccounts[hash] = testData[key]
    keyMap[hash] = key
  }
  */

  const testDataKeys = Object.keys(testData)
  let i = 0
  for (let key in testData) {
    log.trace('verifying expected account:', key)
    const addressKey = key.substr(2)

    stateManager.getAccountFromDb(addressKey, function(err, result) {
    try {

      i = i + 1

      log.trace('util.js verifyPostConditions got getAccountFromDb for address ' + addressKey + ' result:', result)
      const actualAccount = result
      const actualAccountBalance = (new BN(actualAccount.balance.toString('hex'), 16)).toString(16)
      log.trace('actualAccount balance:', actualAccountBalance)

      const actualAccountNonce = (new BN(actualAccount.nonce.toString('hex'), 16)).toNumber()
      log.trace('actualAccount nonce:', actualAccountNonce)

      const expectedAccountBalance = (new BN(testData[key]['balance'].substr(2), 16)).toString(16)
      log.trace('expectedAccount balance:', expectedAccountBalance)

      const expectedAccountNonce = (new BN(testData[key]['nonce'].substr(2), 16)).toNumber()
      log.trace('expectedAccount nonce:', expectedAccountNonce)

      log.trace('expectedAccountCode:', testData[key]['code'])
      const expectedAccountCodeHash = utils.sha3(testData[key]['code']).toString('hex')
      log.trace('expectedAccountCodeHash:', expectedAccountCodeHash)

      const actualAccountCodeHash = actualAccount.codeHash.toString('hex')
      log.trace('actualAccountCodeHash:', actualAccountCodeHash)

      t.equal(actualAccountNonce, expectedAccountNonce, 'account nonce')

      t.equal(actualAccountBalance, expectedAccountBalance, 'account balance')

      t.equal(actualAccountCodeHash, expectedAccountCodeHash, 'account code hash')

      const actualAccountStorageRoot = actualAccount.stateRoot.toString('hex')
      log.trace('actualAccountStorageRoot:', actualAccountStorageRoot)
      
      const expectedStorage = testData[key]['storage']
      const expectedStorageKeys = Object.keys(expectedStorage)
      
      if (expectedStorageKeys.length === 0 && actualAccountStorageRoot !== EMPTY_TRIE_ROOT) {
        t.fail('account storage root should not be empty!')
      }
      if (expectedStorageKeys.length > 0) {
        //stateManager.db.getAccountStorage(addressKey)
      }
      
      if (i >= testDataKeys.length) {
        console.log('util.js verifyPostConditions did all accounts...')
        cb()
      }

    } catch (err) {
      console.log('util.js verifyPostConditions getAccountFromDb callback caught error:', err)
      cb()
    }

    })

  }

  /*
  log.trace('util.js verifyPostConditions testData:', testData)
  log.trace('util.js verifyPostConditions calling getAllAccountStorage...')
  stateManager.getAllAccountStorage(function(result) {
    log.trace('util.js verifyAccountPostConditions getAllAccountStorage result:', result)
    // TODO: compare accounts
    const actualAccounts = Object.keys(result)
    
    actualAccounts.forEach(address => {
      const hexPrefixAddress = '0x' + address
      log.trace('actualAccounts foreach address:', address)
      if (testData[hexPrefixAddress]) {
        q.push({
          address: address,
          account: result[address],
          testData: testData[hexPrefixAddress]
        })
      } else {
        t.fail('invalid account in postState: ' + address)
      }

    })

    q.push(null, cb)
    //cb()
  })

  var q = async.queue(function (task, cb2) {
    // exports.verifyAccountPostConditions(state, task.address, task.account, task.testData, t, cb2)
    function veryAccountCB() {
      log.trace('verifyAccount CB for address:', task.address)
      cb2()
    }

    if (task) {
      log.trace('calling verifyAccountPostConditions on address:', task.address)
      exports.verifyAccountPostConditions(stateManager, task.address, task.account, task.testData, t, veryAccountCB)
    } else {
      log.trace('verifyAccountPostConditions finished.')
      cb()
    }

  }, 1)
  */


}

/**
 * verifyAccountPostConditions using JSON from tests repo
 * @param {[type]}   state    DB/trie
 * @param {[type]}   string   Account Address
 * @param {[type]}   account  to verify
 * @param {[type]}   acctData postconditions JSON from tests repo
 * @param {Function} cb       completion callback
 */
//exports.verifyAccountPostConditions = function (stateManager, address, actualAccountStorage, expectedAccountPostState, t, cb) {
exports.verifyAccountPostConditions = function (stateManager, address, actualAccountStorage, expectedAccountPostState, t, cb) {
  log.trace('util.js verifyAccountPostConditions.')
  t.comment('Account: ' + address)
  /*
  t.equal(format(account.balance, true).toString('hex'), format(acctData.balance, true).toString('hex'), 'correct balance')
  t.equal(format(account.nonce, true).toString('hex'), format(acctData.nonce, true).toString('hex'), 'correct nonce')
  */

  // TODO: verify account balance, nonce, code
  // the balance, nonce, code is in acctData

  // validate storage
  //var origRoot = state.root

  const expectedStorage = expectedAccountPostState.storage
  const expectedStorageKeys = Object.keys(expectedStorage)
  log.trace('expectedStorageKeys:', expectedStorageKeys)
  
  log.trace('actualAccountStorage:', actualAccountStorage)

  const actualStorageKeys = Object.keys(actualAccountStorage)
  log.trace('actualStorageKeys:', actualStorageKeys)



  /*
  var hashedStorage = {}
  for (var key in acctData.storage) {
    hashedStorage[utils.sha3(utils.setLength(Buffer.from(key.slice(2), 'hex'), 32)).toString('hex')] = acctData.storage[key]
  }
  */

  if (expectedStorageKeys.length > 0) {
    //state.root = account.stateRoot
    
    if (actualStorageKeys.length !== expectedStorageKeys.length) {
      t.fail('account has wrong number of storage keys!')
    }

    expectedStorageKeys.forEach(key => {
      log.trace('storageKeys forEach key:', key)
      const paddedKey = utils.setLength(Buffer.from(new BN(key.slice(2), 16).toArray()), 32).toString('hex')
      log.trace('paddedKey:', paddedKey)
      const actualValue = actualAccountStorage[paddedKey]
      log.trace('actualValue:', actualValue)
      const expectedValue = expectedStorage[key].substr(2)
      log.trace('expectedValue:', expectedValue)
      t.equal(actualValue, expectedValue, 'storage key '+key+' correct')
    })

    cb()

  } else {
    if (actualStorageKeys.length !== 0) {
      t.fail('account should have no storage!')
    }
    cb()
  }
}

/**
 * verifyGas by computing the difference of coinbase account balance
 * @param {Object} results  to verify
 * @param {Object} testData from tests repo
 */
exports.verifyGas = function (results, testData, t) {
  var coinbaseAddr = testData.env.currentCoinbase
  var preBal = testData.pre[coinbaseAddr] ? testData.pre[coinbaseAddr].balance : 0

  if (!testData.post[coinbaseAddr]) {
    return
  }

  var postBal = new BN(testData.post[coinbaseAddr].balance)
  var balance = postBal.sub(preBal).toString()
  if (balance !== '0') {
    var amountSpent = results.gasUsed.mul(testData.transaction.gasPrice)
    t.equal(amountSpent.toString(), balance, 'correct gas')
  } else {
    t.equal(results, undefined)
  }
}

/**
 * verifyLogs
 * @param {Object} results  to verify
 * @param {Object} testData from tests repo
 */
exports.verifyLogs = function (logs, testData, t) {
  if (testData.logs) {
    testData.logs.forEach(function (log, i) {
      var rlog = logs[i]
      t.equal(rlog[0].toString('hex'), log.address, 'log: valid address')
      t.equal('0x' + rlog[2].toString('hex'), log.data, 'log: valid data')
      log.topics.forEach(function (topic, i) {
        t.equal(rlog[1][i].toString('hex'), topic, 'log: invalid topic')
      })
    })
  }
}

/**
 * toDecimal - converts buffer to decimal string, no leading zeroes
 * @param  {Buffer}
 * @return {String}
 */
exports.toDecimal = function (buffer) {
  return new BN(buffer).toString()
}

/**
 * fromDecimal - converts decimal string to buffer
 * @param {String}
 *  @return {Buffer}
 */
exports.fromDecimal = function (string) {
  return Buffer.from(new BN(string).toArray())
}

/**
 * fromAddress - converts hexString address to 256-bit buffer
 * @param  {String} hexString address for example '0x03'
 * @return {Buffer}
 */
exports.fromAddress = function (hexString) {
  return utils.setLength(Buffer.from(new BN(hexString.slice(2), 16).toArray()), 32)
}

/**
 * toCodeHash - applies sha3 to hexCode
 * @param {String} hexCode string from tests repo
 * @return {Buffer}
 */
exports.toCodeHash = function (hexCode) {
  return utils.sha3(Buffer.from(hexCode.slice(2), 'hex'))
}

exports.makeBlockHeader = function (data) {
  var header = {}
  header.timestamp = format(data.currentTimestamp)
  header.gasLimit = format(data.currentGasLimit)
  if (data.previousHash) {
    header.parentHash = format(data.previousHash, false, true)
  }
  header.coinbase = utils.setLength(format(data.currentCoinbase, false, true), 20)
  header.difficulty = format(data.currentDifficulty)
  header.number = format(data.currentNumber)
  return header
}

/**
 * makeBlockFromEnv - helper to create a block from the env object in tests repo
 * @param {Object} env object from tests repo
 * @param {Object} transactions transactions for the block
 * @return {Object}  the block
 */
exports.makeBlockFromEnv = function (env, transactions) {
  return new Block({
    header: exports.makeBlockHeader(env),
    transactions: transactions || {},
    uncleHeaders: []
  })
}

/**
 * makeRunCodeData - helper to create the object for VM.runCode using
 *   the exec object specified in the tests repo
 * @param {Object} exec    object from the tests repo
 * @param {Object} account that the executing code belongs to
 * @param {Object} block   that the transaction belongs to
 * @return {Object}        object that will be passed to VM.runCode function
 */
exports.makeRunCodeData = function (exec, account, block) {
  return {
    account: account,
    origin: format(exec.origin, false, true),
    code: format(exec.code), // slice off 0x
    value: format(exec.value),
    address: format(exec.address, false, true),
    caller: format(exec.caller, false, true),
    data: format(exec.data), // slice off 0x
    gasLimit: format(exec.gas),
    gasPrice: format(exec.gasPrice),
    block: block
  }
}

/**
 * setupPreConditions given JSON testData
 * @param {[type]}   state    - the state DB/trie
 * @param {[type]}   testData - JSON from tests repo
 * @param {Function} done     - callback when function is completed
 */
//exports.setupPreConditions = function (state, testData, done) {
exports.setupPreConditions = function (stateManager, testData, done) {
  log.trace('util.js setupPreConditions...',)

  var keysOfPre = Object.keys(testData.pre)
  log.trace('keysOfPre:', keysOfPre)

  async.eachSeries(keysOfPre, function (key, callback) {
    var acctData = testData.pre[key]
    const accountAddress = utils.stripHexPrefix(key)
    log.trace('setupPreConditions for account:', key)
    var account = new Account()

    account.nonce = format(acctData.nonce)
    account.balance = format(acctData.balance)

    var codeBuf = Buffer.from(acctData.code.slice(2), 'hex')
    account.codeHash = utils.sha3(codeBuf)

    //var storageTrie = stateManager.trie.copy()
    //storageTrie.root = null
    let storageTrieRoot = null

    async.series([

      function (cb2) {
        var keys = Object.keys(acctData.storage)
        log.trace('storage keys:', keys)
        if (keys.length > 0) {
          storageTrieRoot = true
        }

        async.forEachSeries(keys, function (key, cb3) {
          log.trace('for each storage key:', key)
          var val = acctData.storage[key]
          log.trace('val:', val)
          // rlp encoding of the value is now handled by setAccountStorage
          //val = rlp.encode(Buffer.from(val.slice(2), 'hex'))
          val = Buffer.from(val.slice(2), 'hex')
          key = utils.setLength(Buffer.from(key.slice(2), 'hex'), 32)

          //stateManager.db.setAccountStorage
          stateManager.setAccountStorage(accountAddress, key, val, cb3)
          //storageTrie.put(key, val, cb3)
        }, cb2)
      },
      function (cb) {
        if (storageTrieRoot) {
          // dummy root hash to distinguish between empty and non-empty
          storageTrieRoot = 'dead2f043ee3c3a67dbc99006258cee3429673b883c242f5ebfa8a6b38b62f6b'
        } else {
          storageTrieRoot = EMPTY_TRIE_ROOT
        }
        cb()
        /*
        stateManager.getContractStorageRoot(accountAddress, function(err, result) {
          if (err) {
            log.trace('util.js setupPreConditions getContractStorageRoot callback err:', err)
          }
          log.trace('util.js setupPreConditions getContractStorageRoot callback result:', result)
          storageTrieRoot = result
          cb()
        })
        */
      },
      function (cb) {
        // right here the stateroot gets set to empty??
        //account.setCode(stateManager.trie, codeBuf, cb)
        if (codeBuf.length > 0) {
          stateManager.setAccountCode(accountAddress, codeBuf.toString('hex'), cb)
        } else {
          cb()
        }
      },
      function (cb2) {

        account.stateRoot = Buffer.from(storageTrieRoot, 'hex')

        if (testData.exec && key === testData.exec.address) {
          testData.root = storageTrie.root
        }

        //log.trace('calling stateManager.cache.put on key:', key)
        //state.put(Buffer.from(utils.stripHexPrefix(key), 'hex'), account.serialize(), function () {
        //log.trace('calling put with account:', account)
        //stateManager._putAccount(Buffer.from(utils.stripHexPrefix(key), 'hex'), account, function () {
        //stateManager._putAccount(utils.stripHexPrefix(key), account, function () {
        stateManager.setAccount(utils.stripHexPrefix(key), account, function () {
          cb2()
        })
      },
      function (cb3) {
        stateManager.cache.flush(function() {
          log.trace('util.js cache flushed!')
          cb3()
        })
      }
    ], callback)
  }, done)
}
