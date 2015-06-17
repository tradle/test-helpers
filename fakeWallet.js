var Wallet = require('simple-wallet')
var bitcoin = require('bitcoinjs-lib')
var typeforce = require('typeforce')

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

  var unspents = []
  var blocks = []
  var w = new Wallet({
    networkName: options.networkName || 'testnet',
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
