var Wallet = require('simple-wallet')
var bitcoin = require('bitcoinjs-lib')
var typeforce = require('typeforce')
var utils = require('tradle-utils')
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
  var w = new Wallet({
    networkName: networkName,
    blockchain: options.blockchain || {
      blocks: {
        get: function (heights, cb) {
          process.nextTick(function () {
            var matched = blocks.filter(function (b) {
              return heights.indexOf(b.height) !== -1
            })

            if (matched.length) return cb(null, matched)
            else return cb(new Error('no blocks found'))
          })
        }
      },
      addresses: {
        transactions: function (addrs, height, cb) {
          if (typeof height === 'function') {
            cb = height
            height = 0
          }

          height = height || 0
          var txs = blocks.filter(function (b) {
            return b.height >= height
          })
          .reduce(function (txs, b) {
            return txs.concat(b.transactions.filter(function (tx) {
              tx.block = b // ugly side effect

              var added = tx.outs.map(function (out) {
                return utils.getAddressFromOutput(out, networkName)
              }).some(hasAddr)

              if (!added) {
                added = tx.ins.map(function (input) {
                  return utils.getAddressFromInput(input, networkName)
                }).some(hasAddr)
              }

              return added

              function hasAddr (addr) {
                return addrs.indexOf(addr) !== -1
              }
            }))
          }, [])

          if (!txs.length) return cb(new Error('no txs found'))

          cb(null, txs.map(function (tx) {
            return {
              txId: tx.getId(),
              txHex: tx.toHex(),
              blockId: tx.block.getId(),
              blockHeight: tx.block.height
            }
          }))
        },
        unspents: function (addr, cb) {
          cb(null, unspents)
        },
        summary: function (addrs, cb) {
          cb(null, addrs.map(function (a) {
            return {
              balance: total
            }
          }))
        }
      },
      transactions: {
        propagate: function (tx, cb) {
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
          b.height = blocks.length
          b.transactions = [bitcoin.Transaction.fromHex(tx)]
          blocks.push(b)
          sendTx(tx, cb)
        }
      }
    },
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
  cb()
}
