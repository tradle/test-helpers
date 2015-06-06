var Wallet = require('simple-wallet')
var bitcoin = require('bitcoinjs-lib')
var typeforce = require('typeforce')

module.exports = function (config) {
  typeforce({
    priv: 'String',
    unspents: 'Array'
  }, config)

  var privateWif = config.priv
  var walletUnspents = config.unspents
  var total = walletUnspents.reduce(function (sum, n) {
    return sum + n
  }, 0)

  var priv = privateWif ?
    bitcoin.ECKey.fromWIF(privateWif) :
    bitcoin.ECKey.makeRandom('testnet')

  var unspents = []
  var w = new Wallet({
    network: 'testnet',
    blockchain: {
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
        propagate: sendTx
      }
    },
    priv: priv
  })

  w.sendTx = sendTx
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
    prevTx.addOutput(address, amount)
  })

  return prevTx
}

function sendTx (tx, cb) {
  cb()
}
