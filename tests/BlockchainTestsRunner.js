const async = require('async')
const testUtil = require('./util.js')
const ethUtil = require('ethereumjs-util')
const Trie = require('merkle-patricia-tree/secure')
const StateManager = require('../lib/stateManager.js')
const Block = require('ethereumjs-block')
const Blockchain = require('ethereumjs-blockchain')
const BlockHeader = require('ethereumjs-block/header.js')
const Level = require('levelup')
const { performance } = require('perf_hooks');

var cacheDB = new Level('./.cachedb')
module.exports = function runBlockchainTest (options, testData, t, cb) {
  var blockchainDB = new Level('', {
    db: require('memdown')
  })
  //var state = new Trie()
  var blockchain = new Blockchain(blockchainDB)
  blockchain.ethash.cacheDB = cacheDB
  const stateManager = new StateManager({
    'blockchain': blockchain
  })
  var VM
  if (options.dist) {
    VM = require('../dist/index.js')
  } else {
    VM = require('../lib/index.js')
  }
  var vm = new VM({
    'stateManager': stateManager
    //'blockchain': blockchain
  })
  var genesisBlock = new Block()

  testData.homestead = true
  if (testData.homestead) {
    vm.on('beforeTx', function (tx) {
      tx._homestead = true
    })
    vm.on('beforeBlock', function (block) {
      block.header.isHomestead = function () {
        return true
      }
    })
  }
  async.series([
    function (done) {
      // clear db
      stateManager.db.clear(function() {
        console.log('BlockchainTestsRunner.js db clear done!')
        done()
      })
    },
    // set up pre-state
    function (done) {
      //testUtil.setupPreConditions(state, testData, function () {
      testUtil.setupPreConditions(stateManager, testData, function () {
        done()
      })
    },
    function (done) {
      // create and add genesis block
      genesisBlock.header = new BlockHeader(formatBlockHeader(testData.genesisBlockHeader))

      //t.equal(state.root.toString('hex'), genesisBlock.header.stateRoot.toString('hex'), 'correct pre stateRoot')

      testUtil.dumpState(stateManager.trie, function(err) {
        console.log('BlockchainTestsRunner.js after setupPreConditions dumpState err:', err)
      })

      //t.equal(stateManager.trie.root.toString('hex'), genesisBlock.header.stateRoot.toString('hex'), 'correct pre stateRoot')

      if (testData.genesisRLP) {
        t.equal(genesisBlock.serialize().toString('hex'), testData.genesisRLP.slice(2), 'correct genesis RLP')
      }
      const t0 = performance.now()
      blockchain.putGenesis(genesisBlock, function (err) {
        const t1 = performance.now()
        console.log("Call to putGenesis took " + (t1 - t0).toFixed(2) + " milliseconds.")
        done(err)
      })
    },
    function (done) {
      async.eachSeries(testData.blocks, function (raw, cb) {
        try {
          var block = new Block(Buffer.from(raw.rlp.slice(2), 'hex'))
          // forces the block into thinking they are homestead
          if (testData.homestead) {
            block.header.isHomestead = function () {
              return true
            }
            block.uncleHeaders.forEach(function (uncle) {
              uncle.isHomestead = function () {
                return true
              }
            })
          }
          const t0 = performance.now()
          blockchain.putBlock(block, function (err) {
            const t1 = performance.now()
            console.log("Call to putBlock took " + (t1 - t0).toFixed(2) + " milliseconds.")
            cb(err)
          })
        } catch (err) {
          cb()
        }
      }, function () {
        done()
      })
    },
    function runBlockchain (done) {
      const t0 = performance.now()
      // right here is where runBlockchain.js getStartingState is called
      // which calls generateCanonicalGenesis()
      vm.runBlockchain(function () {
        const t1 = performance.now()
        console.log("Call to runBlockchain took " + (t1 - t0).toFixed(2) + " milliseconds.")
        done()
      })
    },
    function getHead (done) {
      vm.blockchain.getHead(function (err, block) {
        if (testData.lastblockhash.substr(0, 2) === '0x') {
          // fix for BlockchainTests/GeneralStateTests/stRandom/*
          testData.lastblockhash = testData.lastblockhash.substr(2)
        }
        //t.equal(block.hash().toString('hex'), testData.lastblockhash, 'last block hash')

        // if the test fails, then block.header is the preState because
        // vm.runBlock has a check that prevents the actual postState from being
        // imported if it is not equal to the expected postState. it is useful
        // for debugging to skip this, so that verifyPostConditions will compare
        // testData.postState to the actual postState, rather than to the preState.
        if (!options.debug) {
          // make sure the state is set before checking post conditions
          // state.root = block.header.stateRoot
          stateManager.trie.root = block.header.stateRoot
        }
        done(err)
      })
    },
    function (done) {
      console.log('BlockhainTestsRunner.js verify. options.debug:', options.debug)
      if (options.debug) {

        testUtil.verifyPostConditions(stateManager, testData.postState, t, done)

      } else {
        done()
      }
    }
  ], function () {

    // t.equal(blockchain.meta.rawHead.toString('hex'), testData.lastblockhash, 'correct header block')

    stateManager.quitDb()
    console.log('BlockchainTestsRunner.js called quitdb. now calling cb..')
    cb()
  })
}

function formatBlockHeader (data) {
  var r = {}
  var keys = Object.keys(data)
  keys.forEach(function (key) {
    r[key] = ethUtil.addHexPrefix(data[key])
  })
  return r
}
