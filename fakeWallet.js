var Wallet = require('@tradle/simple-wallet')
var bitcoin = require('@tradle/bitcoinjs-lib')
var typeforce = require('typeforce')
var utils = require('@tradle/utils')
var crypto = require('crypto')

module.exports = function (options) {
  typeforce({
    unspents: 'Array'
  }, options)

  var walletUnspents = options.unspents
  var total = walletUnspents.reduce(function (sum, n) {
    return sum + n
  }, 0)

  var priv = options.priv
  if (typeof priv === 'string') {
    priv = bitcoin.ECKey.fromWIF(priv)
  } else if (!priv) {
    priv = bitcoin.ECKey.makeRandom(true)
  }

  if (!priv) throw new Error('invalid "priv"')

  var networkName = options.networkName || 'testnet'
  var unspents = []
  var blocks = []
  var blockchain = options.blockchain
  if (!blockchain) {
    var ADDR_CACHE = {}
    blockchain = {
      blocks: {
        get: function (heights, cb) {
          process.nextTick(function () {
            var matched = blocks.filter(function (b) {
              return heights.indexOf(b.blockHeight) !== -1
            })

            if (matched.length) return cb(null, matched)
            else return cb(new Error('no blocks found'))
          })
        },
        latest: function (cb) {
          process.nextTick(function () {
            cb(null, blocks[blocks.length - 1])
          })
        }
      },
      addresses: {
        transactions: function (addrs, height, cb) {
          process.nextTick(function () {
            if (typeof height === 'function') {
              cb = height
              height = 0
            }

            height = height || 0
            var txs = blocks.filter(function (b) {
              return b.blockHeight >= height
            })
            .reduce(function (txs, b) {
              return txs.concat(b.transactions.filter(function (tx) {
                tx.block = b // ugly side effect

                var txId = tx.getId()
                var cached = ADDR_CACHE[txId]
                if (!cached) {
                  cached = ADDR_CACHE[txId] = tx.outs.map(function (out) {
                    return utils.getAddressFromOutput(out, networkName)
                  }).concat(tx.ins.map(function (input) {
                    return utils.getAddressFromInput(input, networkName)
                  })).filter(function (a) {
                    return a // filter out nulls
                  })
                }

                return cached.some(function (addr) {
                  return addrs.indexOf(addr) !== -1
                })
              }))
            }, [])

            if (!txs.length) return cb(null, [])

            cb(null, txs.map(function (tx) {
              return {
                txId: tx.getId(),
                txHex: tx.toHex(),
                blockId: tx.block.getId(),
                blockHeight: tx.block.blockHeight
              }
            }))
          })
        },
        unspents: function (addr, cb) {
          process.nextTick(function () {
            cb(null, unspents)
          })
        },
        summary: function (addrs, cb) {
          process.nextTick(function () {
            cb(null, addrs.map(function (a) {
              return {
                balance: total
              }
            }))
          })
        }
      },
      transactions: {
        get: function (txIds, cb) {
          process.nextTick(function () {
            var txs = blocks.reduce(function (soFar, b) {
              return soFar.concat(b.transactions)
            }, [])
            .filter(function (tx) {
              return txIds.indexOf(tx.getId()) !== -1
            })
            .map(function (tx) {
              return {
                txId: tx.getId(),
                txHex: tx.toHex(),
                blockId: tx.block.getId(),
                blockHeight: tx.block.blockHeight
              }
            })

            cb(null, txs)
          })
        },
        propagate: function (tx, cb) {
          var b = addFakeBlock(blocks)
          b.transactions.push(bitcoin.Transaction.fromHex(tx))
          sendTx(tx, cb)
        }
      },
      _advanceToNextBlock: function () {
        addFakeBlock(blocks)
      }
    }
  }

  var w = new Wallet({
    networkName: networkName,
    blockchain: blockchain,
    priv: priv
  })

  var tx = fund(w.address, walletUnspents)
  tx.outs.forEach(function (o, i) {
    unspents.push({
      txId: tx.getId(),
      confirmations: 6,
      address: w.addressString,
      value: o.value,
      vout: i
    })
  })

  return w
}

function fund (address, walletUnspents) {
  var prevTx = new bitcoin.Transaction()
  prevTx.addInput(new bitcoin.Transaction(), 0)
  walletUnspents.forEach(function (amount) {
    prevTx.addOutput(address.toString(), amount)
  })

  return prevTx
}

function sendTx (tx, cb) {
  process.nextTick(cb)
}

function addFakeBlock (blocks) {
  var b = new bitcoin.Block()
  if (blocks.length) {
    b.prevHash = blocks[blocks.length - 1].getHash()
  } else {
    b.prevHash = crypto.randomBytes(32)
  }

  b.merkleRoot = crypto.randomBytes(32)
  b.timestamp = Date.now() / 1000
  b.bits = Math.random() * 100000000 | 0
  b.nonce = Math.random() * 100000000 | 0
  b.height = b.blockHeight = blocks.length
  b.transactions = []
  blocks.push(b)
  return b
}
