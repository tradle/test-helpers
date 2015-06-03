var Wallet = require('simple-wallet')
var bitcoin = require('bitcoinjs-lib')

module.exports = function fakeWallet (privateWif, amount) {
  if (typeof privateWif === 'number') {
    amount = privateWif
    privateWif = null
  }

  var priv = privateWif ?
    bitcoin.ECKey.fromWIF(privateWif) :
    bitcoin.ECKey.makeRandom('testnet')

  var total = 100000
  var numUnspents = 1
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
        propagate: function (tx, cb) {
          cb()
        }
      }
    },
    priv: priv
  })

  var tx = fund(w.address, total, numUnspents)
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

function fund (address, amount, n) {
  var prevTx = new bitcoin.Transaction()
  prevTx.addInput(new bitcoin.Transaction(), 0)
  for (var i = 0; i < n; i++) {
    prevTx.addOutput(address, amount / n)
  }

  return prevTx
}
