const async = require('async')
const { performance } = require('perf_hooks');

/**
 * processes blocks and adds them to the blockchain
 * @method onBlock
 * @param blockchain
 */
module.exports = function (blockchain, cb) {
  var self = this
  var headBlock, parentState

  self.blockchain = self.stateManager.blockchain

  // parse arguments
  if (typeof blockchain === 'function') {
    cb = blockchain
  } else if (blockchain) {
    self.blockchain = blockchain
  }

  // setup blockchain iterator
  self.blockchain.iterator('vm', processBlock, cb)
  function processBlock (block, reorg, cb) {
    async.series([
      getStartingState,
      runBlock
    ], cb)

    let t_start_generateGenesisState = null
    let t_end_generateGenesisState = null
    // determine starting state for block run
    function getStartingState (cb) {
      // if we are just starting or if a chain re-org has happened
      if (!headBlock || reorg) {
        self.blockchain.getBlock(block.header.parentHash, function (err, parentBlock) {
          parentState = parentBlock.header.stateRoot
          // generate genesis state if we are at the genesis block
          // we don't have the genesis state
          if (!headBlock) {
            console.log('calling generateCanonicalGenesis...')
            t_start_generateGenesisState = performance.now()
            //return self.stateManager.generateCanonicalGenesis(cb)
            cb()
          } else {
            cb(err)
          }
        })
      } else {
        parentState = headBlock.header.stateRoot
        cb()
      }
    }

    // run block, update head if valid
    function runBlock (cb) {
      t_end_generateGenesisState = performance.now()
      console.log("Call to generateCanonicalGenesis took " + (t_end_generateGenesisState - t_start_generateGenesisState).toFixed(2) + " milliseconds.")
      const t_start_runBlock = performance.now()
      self.runBlock({
        block: block,
        root: parentState
      }, function (err, results) {
        const t_end_runBlock = performance.now()
        console.log("Call to runBlock took " + (t_end_runBlock - t_start_runBlock).toFixed(2) + " milliseconds.")
        if (err) {
          // remove invalid block
          console.log('Invalid block error:', err)
          self.blockchain.delBlock(block.header.hash(), cb)
        } else {
          // set as new head block
          headBlock = block
          cb()
        }
      })
    }
  }
}
