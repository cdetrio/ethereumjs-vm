const Buffer = require('safe-buffer').Buffer
//const Tree = require('functional-red-black-tree')
//const { Map } = require('immutable')
const Account = require('ethereumjs-account')
const utils = require('ethereumjs-util')
const BN = utils.BN
const rlp = utils.rlp

//const async = require('async')
const log = require('loglevel').getLogger('redis-db')

const Redis = require('ioredis');
const redis = new Redis();


//log.setLevel("trace")
log.setLevel("silent")

//var Cache = module.exports = function (trie) {
var Db = module.exports = function () {
  //this._cache = Map()
  this._checkpoints = []
  this._deletes = []
  //this._trie = trie
  //this._db = db
  this._storageAccounts = []

  //initRedisStorageKey()
}

// redis.quit(); to close redis connection





redis.set('foo', 'bar3215');
log.trace('testRedis set foo.')

const ACCOUNTS_REDIS_KEY = "mapOfAccounts"

const ACCOUNTS_CODE_REDIS_KEY = "mapOfAccountCode"



Db.prototype.setAccountCode = function (address, value, cb) {
  log.trace('Db.setAccount address, value:', address, value)
  if (typeof address !== 'string') {
    throw(new Error('redis-db.js setAccountCode address should be string!!'))
  }
  if (typeof value !== 'string') {
    throw(new Error('redis-db.js setAccountCode value should be string!!'))
  }
  // HSET mapOfAccountCode deadbeef "0xffffff"
  redis.hset(ACCOUNTS_CODE_REDIS_KEY, address, value)
  cb()
}


Db.prototype.getAccountCode = async function (address, cb) {
  log.trace('Db.getAccountCode address:', address)
  if (typeof address !== 'string') {
    throw(new Error('redis-db.js getAccountCode address should be string!!'))
  }
  // HGET mapOfAccountCode deadbeef
  let result = await redis.hget(ACCOUNTS_CODE_REDIS_KEY, address)
  log.trace('Db.getAccountCode got result:', result)
  //if (result === null)
  cb(null, result)
}




Db.prototype.setAccount = function (address, value, cb) {
  log.trace('Db.setAccount address, value:', address, value)
  if (typeof address !== 'string') {
    throw(new Error('redis-db.js setAccount address should be string!!'))
  }
  // HSET mapOfAccounts deadbeef "balance:0,nonce:1,codehash:cd52,storageroot:5e23"
  redis.hset(ACCOUNTS_REDIS_KEY, address, value)
  cb()
}


Db.prototype.getAccount = async function (address, cb) {
  log.trace('Db.getAccount address:', address)
  if (typeof address !== 'string') {
    throw(new Error('redis-db.js getAccount address should be string!!'))
  }
  if (address.substr(0,2) === '0x') {
    throw(new Error('redis-db.js getAccount address should not start with 0x!'))
  }
  // HGET mapOfAccounts deadbeef
  let result = await redis.hget(ACCOUNTS_REDIS_KEY, address)
  log.trace('Db.getAccount got for key ' + address + ' result:', result)
  //if (result === null)
  cb(null, result)
}


Db.prototype.deleteAccount = function (address, cb) {
  log.trace('Db.deleteAccount address:', address)
  if (typeof address !== 'string') {
    throw(new Error('redis-db.js deleteAccount address should be string!!'))
  }
  // HSET mapOfAccounts deadbeef "balance:0,nonce:1,codehash:cd52,storageroot:5e23"
  redis.hdel(ACCOUNTS_REDIS_KEY, address)
  cb()
}


/*

const STORAGE_REDIS_KEY = "accountStorage"

function initRedisStorageKey() {
  var redisStorageJson = new Redis.Command('JSON.SET', [STORAGE_REDIS_KEY, '.', '{}'], 'utf8')
  log.trace('redisStorageJson command defined.')
  redisStorageJson.promise.then(function (result) {
    log.trace('redisStorageJson promise result:')
    log.trace(result);
    //cb()
  });
  log.trace('sending command redisStorageJson...')
  redis.sendCommand(redisStorageJson);
}


function createAccountInStorageMap(address) {
  const createAccountPathString = '["$' + address + '"]'
  const createAccountJson = new Redis.Command('JSON.SET', [STORAGE_REDIS_KEY, createAccountPathString, '{}'], 'utf8')
  log.trace('createAccountJson command defined.')
  createAccountJson.promise.then(function (result) {
    log.trace('createAccountJson promise result:')
    log.trace(result);
    //cb(result)
  });
  log.trace('sending command createAccountJson...')
  redis.sendCommand(createAccountJson);
}


Db.prototype.setAccountStorage = function (address, key, value, cb) {
  const self = this
  if (typeof address !== 'string') {
    throw(new Error('redis-db.js setAccountStorage address should be string!!'))
  }
  const accountRedisKeyExists = self._storageAccounts.includes(address)

  // path to set
  log.trace('Db setAccountStorage. address:', address)
  log.trace('Db setAccountStorage. key, value:', key, value)
  log.trace('accountRedisKeyExists:', accountRedisKeyExists)
  const pathString = '["$' + address + '"]' + '["$' + key.toString('hex') + '"]'
  log.trace('pathString:', pathString)

  try {
    if (accountRedisKeyExists === false) {
      createAccountInStorageMap(address)
      self._storageAccounts.push(address)
    }

    let setJson = null
    if (value.toString('hex') === '') {
      // remove value
      setJson = new Redis.Command('JSON.DEL', [STORAGE_REDIS_KEY, pathString], 'utf8')
    } else {
      setJson = new Redis.Command('JSON.SET', [STORAGE_REDIS_KEY, pathString, '"'+value.toString('hex')+'"'], 'utf8')
    }

    log.trace('setJson command defined.')

    setJson.promise.then(function (result) {
      log.trace('setJson promise result:')
      log.trace(result)
      cb()
    }).catch(err => {
      log.trace('setAccountStorage setJson caught error:', err)
      log.trace('setAccountStorage called with pathString:', pathString)
      cb()
    })

    redis.sendCommand(setJson);
  } catch (err) {
    log.trace('Db.setAccountStorage caught exception!!:', err)
  }
  
}



Db.prototype.getAccountStorage = function (address, key, cb) {
  const self = this
  if (typeof address !== 'string') {
    throw(new Error('redis-db.js getAccountStorage address should be string!!'))
  }

  log.trace('Db getAccountStorage. address:', address)
  log.trace('Db getAccountStorage. key:', key)
  const pathString = '["$' + address + '"]' + '["$' + key.toString('hex') + '"]'
  log.trace('pathString:', pathString)

  try {
    var getJson = new Redis.Command('JSON.GET', [STORAGE_REDIS_KEY, pathString], 'utf8')
    log.trace('getJson command defined.')

    getJson.promise.then(function (result) {
      log.trace('getJson promise result:')
      log.trace(result)
      const resultJsonStr = result.toString('utf8')
      log.trace('resultJsonStr:', resultJsonStr)
      const resultVal = JSON.parse(resultJsonStr)
      log.trace('resultVal:', resultVal)
      const resultBuf = Buffer.from(resultVal, 'hex')
      log.trace('resultBuf:', resultBuf)
      var decoded = rlp.decode(resultBuf)
      // TODO: pass result
      cb(null, decoded)
    }).catch(err => {
      log.trace('getAccountStorage getJson caught error:', err)
      // assume that error is because key doesnt exist
      var decoded = rlp.decode(null)
      cb(null, decoded)
    })

    redis.sendCommand(getJson);
  } catch (err) {
    log.trace('Db.getAccountStorage caught exception!!:', err)
  }
}
*/



Db.prototype.getAllAccountStorage = async function (cb) {
  const self = this

  log.trace('Db getAllAccountStorage')

  try {
    const getJson = new Redis.Command('JSON.GET', [STORAGE_REDIS_KEY, '.'], 'utf8')
    log.trace('getJson command defined.')

    const result = await redis.sendCommand(getJson);
    //getJson.promise.then(function (result) {

      log.trace('getAllAccountStorage promise result:')
      log.trace(result)
      let jsonResult = JSON.parse(result.toString('utf8'))
      log.trace('jsonResult:', jsonResult)
      const accountKeysPrefix$ = Object.keys(jsonResult)
      log.trace('accountKeysPrefix$:', accountKeysPrefix$)
      for (let i in accountKeysPrefix$) {
        const key = accountKeysPrefix$[i]
        log.trace('for i key:', key)
        const addy = key.substr(1) // trim the first char '$'
        log.trace('addy:', addy)
        jsonResult[addy] = jsonResult[key]
        delete jsonResult[key]
      }
      const accountKeys = Object.keys(jsonResult)
      accountKeys.forEach(account => {
        let accountStorage = jsonResult[account]
        log.trace('do account storage:', jsonResult[account])
        const storageKeysPrefix$ = Object.keys(accountStorage)
        for (let i in storageKeysPrefix$) {
          const slotKeyPrefix$ = storageKeysPrefix$[i]
          log.trace('storageKeysPrefix$[i]:', storageKeysPrefix$[i])
          const slotKey = slotKeyPrefix$.substr(1)
          log.trace('slotKey:', slotKey)
          jsonResult[account][slotKey] = jsonResult[account][slotKeyPrefix$]
          delete jsonResult[account][slotKeyPrefix$]
        }
      })

      // TODO: pass result
      cb(jsonResult)
    /*
    }).catch(err => {
      log.trace('getAllAccountStorage getJson caught error:', err)
      // assume that error is because key doesnt exist
      // cb(null, decoded)
    })
    redis.sendCommand(getJson);
    */


  } catch (err) {
    log.trace('Db.getAccountStorage caught exception!!:', err)
  }
}


/*
async function setStorageSortedSet(accountAddr, storageObj) {
  log.trace('running setStorageSortedSet')
  const redisKey = accountAddr + ':' + 'storage'
  log.trace('redisKey:', redisKey)
  const score = 0 // lexicographic ordering by elemString
  for (let preimageKey in storageObj) {
    log.trace('preimageKey:', preimageKey)
    let hashedKey = keccak_256(trieUtil.hexStringToByte(preimageKey))
    const storageVal = storageObj[preimageKey]
    const elemString = hashedKey + ":" + preimageKey + ":" + storageVal
    log.trace('zadd elemString:', elemString)
    let addResult = await redis.zadd(redisKey, score, elemString)
    log.trace('addResult:', addResult)
  }
  redis.quit()
}
*/


// ZRANGEBYLEX 2faa316fc4624ec39adc2ef7b5301124cfb68777:storage [0 (3
/*
127.0.0.1:6379> ZRANGEBYLEX 2faa316fc4624ec39adc2ef7b5301124cfb68777:storage [0 (3
  1) "0081dee8ef46525450c678c11250aaea54cd74ba9fd3587f7383f89a0bdc6424:7eb13957fb60756a164d2a79191e8823e2ddfb8d4b7cbf1fae9e39a9b44303b7:8456cbce0d"
  2) "00ca6002fc0af6a8b12ddba53dcdbf13459abc40dbb15549dd1db10e7e8477df:2da784495062d6c9c25f97b1c8cfed036b3100d1176d6622d5435f16e9f44a1c:8806f05b59d3b20000"
  3) "00fe4744baf8280abe679779689516e0dd816938446f0ccb8bc0f8cfbcd65f66:9966199f5730cac941b8c6de63055ad2e1be3b6f2554cbc2641fb7808af5a7ac:a0c928ab47f2d78d13e501b29ef7e3f9b71fc278256596922394043eabb4cddc68"
  4) "01349884cd8cbce1b1e0329edfae96f00190ebf1ab64aa3c6adfdba626ca227c:c46c61682343a12115776b236314a61652031157494fa2c971865769184adc01:a0e56ee6a5071ef89aa11f85adae5b1bfdb5a57e5a4ddbe2c565814958c515c6df"
  5) "01490a3427d92ee1fc82856e7d6e1719eb8f6c2b821855597f1cc35e37ad936e:cb2ef560e0c0ba321a1c6b48e45251bfc5c267a1f95df2bcca2fa92b9a99b520:820bea"
  6) "014986274bcc929aead72086c76cfd12a04e9c3a3d774e575178ebb5b4172d8f:dd0eb91e19cefe06c561cade892918860a80c5b6f7e132aa0beb2c272f4ed5d0:830ff4a2"
  7) "01632803e657cd2c126b4549bab3745f5f201c08521ec86a7650c8f5ec693c4b:16d0ffa16826ca0147a4d45e3bfb8e11eac1628241155a2c67f1c36f2a629f2d:8806f05b59d3b20000"
  8) "0175b7a638427703f0dbe7bb9bbf987a2551717b34e79f33b5b1008d1fa01db9:000000000000000000000000000000000000000000000000000000000000000b:94c3e44527b935d02d805d8d21dd07ea9d2cd5fc22"
  9) "018f34dcd750da4aa91e5c5365cf33f6dd5582e7c178f052ccb19ebc34aa30aa:7eb13957fb60756a164d2a79191e8823e2ddfb8d4b7cbf1fae9e39a9b44303be:820c4a"
  .....
*/


Db.prototype.setAccountStorage = function (address, key, value, cb) {
  log.trace('db.setAccountStorage address:', address)
  log.trace('db.setAccountStorage key:', key)
  log.trace('db.setAccountStorage value:', value)

  const self = this
  if (typeof address !== 'string') {
    throw(new Error('redis-db.js setAccountStorage address should be string!!'))
  }
  if (address.substr(0,2) === '0x') {
    throw(new Error('redis-db.js setAccountStorage address should not have 0x!'))
  }
  if (typeof key !== 'string') {
    log.trace('db.setAccountstorage key SHOULD be string!:', key)
    key = key.toString('hex')
    
  }

  if (key.substr(0,2) === '0x') {
    log.trace('db.setAccountstorage address, key:', address, key)
    throw(new Error('redis-db.js setAccountStorage key should not have 0x!'))
  }

  if (typeof value !== 'string') {
    log.trace('db.setAccountstorage value SHOULD be string!:', value)
    value = value.toString('hex')
  }


  const redisAccountStorageKey = 'storage:' + address
  log.trace('redisAccountStorageKey:', redisAccountStorageKey)
  const score = 0 // lexicographic ordering by elemString

  // ZSCAN key cursor [MATCH pattern] [COUNT count]
  // ZSCAN redisAccountStorageKey 0 MATCH hashedKey* 1

  let hashedKey = utils.sha3('0x' + key).toString('hex')
  log.trace('hashedKey:', hashedKey)

  const preimageKey = key

  // every storage update requires deleting the previous sorted set member
  // ZREMRANGEBYLEX redisAccountStorageKey [hashedKey: [hashedKey:
  const zremMin = `[${hashedKey}:`
  // using the same max as min doesn't work, it returnes 0 results
  // const zremMax = `[${hashedKey}:`

  const hashedKeyPlusOne = (new BN(hashedKey, 16)).addn(1).toString(16, 64)
  const zremMax = `[${hashedKeyPlusOne}`

  log.trace('redis-db.js setAccountStorage zremMin, zremMax:', zremMin, zremMax)

  redis.zremrangebylex(redisAccountStorageKey, zremMin, zremMax)

  if (value !== '') {
    // add updated value
    const valEncoded = rlp.encode('0x' + value).toString('hex')
    const elemString = hashedKey + ":" + preimageKey + ":" + valEncoded
    log.trace('redis-db.js setAccountStorage elemString:', elemString)
    redis.zadd(redisAccountStorageKey, score, elemString)
    // let addResult = await redis.zadd(redisKey, score, elemString)
  } else {
    // value should already be deleted
  }

  cb()
}



Db.prototype.getAccountStorage = async function (address, key, cb) {
  const self = this
  if (typeof address !== 'string') {
    throw(new Error('redis-db.js getAccountStorage address should be string!!'))
  }
  if (typeof key !== 'string') {
    log.trace('redis-db.js getAccountStorage key SHOULD BE string!:', key)
    key = key.toString('hex')
  }
  // ZSCAN storage:b94f5374fce5edbc8e2a8697c15331677e6ebf0b 0

  log.trace('redis-db.js getAccountStorage. address:', address)
  log.trace('redis-db.js getAccountStorage. key:', key)

  const redisAccountStorageKey = 'storage:' + address
  log.trace('redisAccountStorageKey:', redisAccountStorageKey)
  const score = 0 // lexicographic ordering by elemString

  let hashedKey = utils.sha3('0x' + key).toString('hex')
  log.trace('redis-db.js getAccountStorage hashedKey:', hashedKey)

  //ZRANGEBYLEX storage:deadbeef "[00fa...:" "[00fa...:" LIMIT 0 1

  const zMin = `[${hashedKey}:`
  //const zMax = `[${hashedKey}:`
  //const zMax = `+`
  const hashedKeyPlusOne = (new BN(hashedKey, 16)).addn(1).toString(16, 64)
  const zMax = `[${hashedKeyPlusOne}`

  log.trace('redis-db.js getAccountStorage zMin, zMax:', zMin, zMax)

  let result = await redis.zrangebylex(redisAccountStorageKey, zMin, zMax, 'LIMIT', 0, 1)
  //let result = await redis.zrangebylex(redisAccountStorageKey, zMin, zMax)
  log.trace('redis-db.js getAccountStorage result for zmin, zmax:', result, zMin, zMax)

  if (result.length === 0) {
    log.trace('redis-db.js getAccountStorage returned null. returning:', '')
    //cb(null, rlp.encode(null))
    cb(null, '')
  }  else {
    const valEncoded = result[0].substr(130)
    log.trace('redis-db.js getAccountStorage returned valEncoded:', valEncoded)
    const val = rlp.decode('0x' + valEncoded).toString('hex')
    log.trace('redis-db.js getAccountStorage returning val:', val)
    cb(null, val)
  }

}









Db.prototype.get = async function (key, cb) {
  // TODO: fix key
  let result = await redis.get(key);
  log.trace('testRedis got result:', result);

  cb(result)
}


Db.prototype.put = function (key, val, cb) {
  log.trace('Db.put key:', key)
  log.trace('Db.put val:', val.toString('hex'))
  //var modified = !fromTrie
  // TODO: fix key and val
  //edis.set(key, val);
  // HSET mapOfAccounts deadbeef "balance:0,nonce:1,codehash:cd52,storageroot:5e23"
  // HSET mapOfAccounts 00000001 "balance:3,nonce:1,codehash:e5c3,storageroot:a2c5"
  //this._update(key, val, modified, true)
  
  cb()
}


Db.prototype.del = function (key) {
  log.trace('Deb.del key:', key)
  //redis.set(key, val);
}


Db.prototype.clear = async function (cb) {
  // DEL mapOfAccountCode
  // DEL mapOfAccounts
  // DEL accountStorage
  /*
  // these commands aren't working
  const delAccountCode = new Redis.Command('DEL', 'mapOfAccountCode', 'utf8')
  const delAccountMap = new Redis.Command('DEL', 'mapOfAccounts', 'utf8')
  const delAccountStorage = new Redis.Command('DEL', 'accountStorage', 'utf8')

  const delAccountResult = await redis.sendCommand(delAccountCode)
  //const delAccountMapResult = await redis.sendCommand(delAccountMap)
  const delAccountMapResult = await redis.del('mapOfAccounts')
  const delAccountStorageResult = await redis.sendCommand(delAccountStorage)
  log.trace('delAccountMapResult:', delAccountMapResult)
  */
  /*
  function DbClearCallback (result) {
    log.trace('Db Clear promise result:')
    log.trace(result)
  }
  delAccountCode.promise.then(DbClearCallback).catch(err => {
    log.trace('Db.clear promise caught error:', err)
  })
  delAccountMap.promise.then(DbClearCallback).catch(err => {
    log.trace('Db.clear promise caught error:', err)
  })
  delAccountStorage.promise.then(DbClearCallback).catch(err => {
    log.trace('Db.clear promise caught error:', err)
  })
  */

  redis.del('mapOfAccounts')
  redis.del('mapOfAccountCode')
  redis.del('accountStorage')



  // SCAN 0 MATCH storage:*
  let result = await redis.scan(0, "MATCH", "storage:*")
  // scan result: [ '0', [ 'storage:b94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'storage:deadbeef', ... ] ]
  // TODO: handle if result is huge (millions of accounts)
  log.trace('redis-db.js clear scan result:', result)
  const foundKeys = result[1]
  foundKeys.forEach(key => {
    // DEL storage:b94f5374fce5edbc8e2a8697c15331677e6ebf0b
    redis.del(key)
  })


  //const initAccountStorage = new Redis.Command('JSON.SET', [STORAGE_REDIS_KEY, '.', '{}'], 'utf8')
  //redis.sendCommand(initAccountStorage)

  cb()
}


Db.prototype.quit = function () {
  log.trace('redis-db calling quit.')
  redis.quit()
  //redis.disconnect()
}
