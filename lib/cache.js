const Buffer = require('safe-buffer').Buffer
//const Tree = require('functional-red-black-tree')
const { Map } = require('immutable')
const Account = require('ethereumjs-account')
const async = require('async')
const log = require('loglevel').getLogger("cache")

//log.setLevel("trace")
//log.setLevel("debug")
log.setLevel("silent")

//var Cache = module.exports = function (trie) {
var Cache = module.exports = function (trie, db) {
  this._cache = Map()
  this._checkpoints = []
  this._deletes = []
  this._trie = trie
  this._db = db
}

Cache.prototype.put = function (key, val) {
  log.debug('Cache.put key:', key)
  log.debug('Cache.put val:', val)
  if (typeof key !== 'string') {
    key = key.toString('hex')
  }
  if (typeof val !== 'string') {
    // if its not a string then its a raw account..
    //throw(new Error('cache.put called with val that isnt serialized!'))
  } else {
    console.log('cache.js PUT CALLED WITH STRING VALUE.')
    throw(new Error('cache.put called with string value!'))
  }
  this._update(key, val, true, true)
}

// returns the queried account or an empty account
Cache.prototype.get = function (key) {
  log.trace('Cache.get key:', key)
  var account = this.lookup(key)
  if (!account) {
    account = new Account()
    account.exists = false
  }
  return account
}

// returns the queried account or undefined
Cache.prototype.lookup = function (key) {
  key = key.toString('hex')

  var result = this._cache.get(key)
  log.trace('cache lookup key:', key)
  log.trace('cache lookup got result:', result)
  if (result) {
    log.trace('deserializing account..')
    var account = new Account(result.val)
    account.exists = result.exists
    log.trace('cache lookup returning account:', account)
    return account
  }
}


Cache.prototype._lookupAccount = function (address, cb) {
  var self = this

  log.debug('cache._lookupAccount calling db.getAccount')
  let addressStr = address
  if (typeof addressStr !== 'string') {
    addressStr = address.toString('hex')
  }
  self._db.getAccount(addressStr, function(err, raw) {
    log.debug('db.getAccount got result:', raw)
    if (err) return cb(err)
    let account = new Account(raw)
    log.debug('db.getAccount got account with storageRoot:', account.stateRoot)
    let exists = !!raw
    account.exists = exists
    cb(null, account, exists)
  })

}


Cache.prototype.getOrLoad = function (key, cb) {
  log.trace('Cache getOrLoad key:', key.toString('hex'))
  var self = this
  var account = this.lookup(key)
  if (account) {
    log.trace('account found in cache. returning:', account)
    cb(null, account)
  } else {
    log.trace('looking up account in db..')
    self._lookupAccount(key, function (err, account, exists) {
      log.trace('Cache getOrLoad _lookupAccount callbackup. exists:', exists)
      log.trace('err:', err)
      if (err) return cb(err)
      self._update(key, account, false, exists)
      cb(null, account)
    })
  }
}


Cache.prototype.warm = function (addresses, cb) {
  log.trace('cache.js Cache.warm called on addresses:', addresses)
  var self = this
  // shim till async supports iterators
  var accountArr = []
  addresses.forEach(function (val) {
    if (val) accountArr.push(val)
  })

  async.eachSeries(accountArr, function (addressHex, done) {
    var address = Buffer.from(addressHex, 'hex')
    self._lookupAccount(address, function (err, account) {
      if (err) return done(err)
      // cache the result of the db lookup
      self._update(address, account, false, account.exists)
      done()
    })
  }, cb)
}

Cache.prototype.flush = function (cb) {
  var self = this
  console.log('cache.js Cache.flush called')
  //log.debug('trie root before flushing:', self._trie.root.toString('hex'))

  log.trace('cache.toJSON:', JSON.stringify(this._cache.toJSON()))

  const cacheArray = this._cache.toArray()
  let i = 0

  log.trace('cacheArray.length:', cacheArray.length)

  log.debug('cache.js flush() writing modified accounts to db...')
  var next = true
  async.whilst(function () {
    return next
  }, function (done) {

    if (i >= cacheArray.length) {
      next = false
      done()
      return
    }

    function nextItem() {
      if (i < (cacheArray.length-1)) {
        i = i + 1
      } else {
        next = false
      }
      done()
    }

    log.trace('cache.js flush(). iterate over cacheArray i='+i)
    log.trace('cacheArray.length:', cacheArray.length)
    const iterItem = cacheArray[i]
    log.trace('iterItem:', iterItem)
    const itemKey = iterItem[0]
    const itemValue = iterItem[1]
    log.trace('itemValue.val:', itemValue.val)
    if (itemValue.modified) {
      log.trace('item was modified!')
      const valSerialized = itemValue.val.serialize().toString('hex')
      log.trace('valSerialized:', valSerialized)
      // write account to redis db here..

      self._db.setAccount(itemKey, valSerialized, function() {
        log.trace('db put callback for itemKey:', itemKey)
        nextItem()
      })

    } else {
      log.trace('item not modified. going to next...')
      nextItem()
    }
  }, function () {
    log.trace('cache.js flush() write of modified accounts done.')
    //log.debug('trie root before deletions:', self._trie.root.toString('hex'))
    log.trace('cache.js flush() removing deleted accounts from db:', self._deletes)
    async.eachSeries(self._deletes, function (address, done) {
      if (typeof address !== 'string') {
        address = address.toString('hex')
      }
      log.trace('deleting from db address:', address)
      self._db.deleteAccount(address, done)

      /*
      log.trace('deleting from trie address:', address)
      self._trie.del(address, done)
      */
    }, function () {
      log.trace('all deletes are done.')
      self._deletes = []
      cb()
    })
  })

}

Cache.prototype.checkpoint = function () {
  this._checkpoints.push(this._cache)
}

Cache.prototype.revert = function () {
  this._cache = this._checkpoints.pop()
}

Cache.prototype.commit = function () {
  this._checkpoints.pop()
}

Cache.prototype.clear = function () {
  this._deletes = []
  this._cache = Map()
}

Cache.prototype.del = function (key) {
  this._deletes.push(key)
  key = key.toString('hex')
  this._cache = this._cache.delete(key)
}

Cache.prototype._update = function (key, val, modified, exists) {
  log.trace('Cache.update called with key:', key.toString('hex'))
  log.trace('Cache.update called with val:', val)
  if (typeof val === 'string') {
    throw(new Error('cache._update called with string value!'))
  }
  log.trace('val:', val.toJSON())
  log.trace('modified:', modified)
  log.trace('exists:', exists)

  key = key.toString('hex')
  const itemValue = {
    'val': val,
    'modified': modified,
    'exists': exists
  }

  this._cache = this._cache.set(key, itemValue)
}
