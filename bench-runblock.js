const VM = require('./lib/index.js')
const ethUtil = require('ethereumjs-util')
const StateManager = require('./lib/stateManager.js')
const Block = require('ethereumjs-block')
const Blockchain = require('ethereumjs-blockchain')
const BlockHeader = require('ethereumjs-block/header.js')
const { performance } = require('perf_hooks');



const blockRLP = "f90260f901f8a05346a3253b90a76ab5b76d72a3614e758a05ae19673390bf02c5c74da4216b12a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347942adc25665018aa1fe0e6bc666dac8fc2697ff9baa084ab979f1857a701b4a216e23ff36be120b2ac7495f777c565f122353f1b80daa059652e5662eb625efd106d67b9b25d3c12a15e69494d1d24f59d867c211f6761a035ff110323d70cb2b44a294c508539dc65ceebcbdaf1631a0ad07f6679b6f8a5b9010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000830200000183989680830331c58203e880a03e15afc893e05878a6ef73acafb95197835b5b4db28814713ea7cf632df51b2188740ab0971b706792f862f8608001830927c094b94f5374fce5edbc8e2a8697c15331677e6ebf0b80801ba08d0699f23d032b86db35ed7bb39c2357bec870fbfbe7db30b1795d320d8965c6a002f578fd949e84f0dc1307f5dd714c9a7158b31891d43f45459edcb52e345f7cc0"

const blockBuf = Buffer.from(blockRLP, 'hex')


const blockToRun = new Block(blockBuf)

console.log('blockToRun:', blockToRun)
console.log('blockToRun.header:', blockToRun.header)

const stateManager = new StateManager({ })

var vm = new VM({
  'stateManager': stateManager
})


const t_start_runBlock = performance.now()

vm.runBlock({
  block: blockToRun
}, function (err, results) {
  const t_end_runBlock = performance.now()
  const runBlock_time = t_end_runBlock - t_start_runBlock
  console.log("Call to runBlock took " + runBlock_time.toFixed(2) + " milliseconds.")
  console.log('runBlock results:', results)
  const gasUsed = results.results[0].gasUsed.toNumber()
  console.log("runBlock gas used:", gasUsed)
  const mGasPerSecond = (gasUsed / 1000000) / (runBlock_time / 1000)
  // const mGasPerSecond = gasUsed / runBlock_time
  console.log("Call to runBlock mgas/s:", mGasPerSecond.toFixed(2))
  stateManager.db.quit()
})
