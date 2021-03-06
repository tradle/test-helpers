var Q = require('q')
var utils = require('@tradle/utils')

function keeperForMap (map) {
  var keep = {
    _map: map,
    put: putOne,
    putOne: putOne,
    putMany: function (pairs) {
      return Q.all(pairs.map(function (pair) {
        return keep.put(pair.key, pair.value)
      }))
    },
    getOne: function (key) {
      return (key in map) ? Q.resolve(map[key]) : Q.reject(new Error('not found'))
    },
    getMany: function (keys) {
      return Q.allSettled(keys.map(keep.getOne))
        .then(function (results) {
          return results.map(function (r) {
            return r.value
          })
        })
    },
    getAll: function () {
      return Q.resolve(values(map))
    },
    destroy: function () {
      return Q.resolve()
    },
    removeOne: function (key) {
      delete map[key]
      return Q.resolve()
    },
    removeMany: function (keys) {
      keys.forEach(function (key) {
        delete map[key]
      })

      return Q.resolve()
    },
    isKeeper: function () {
      return true
    }
  }

  function putOne (key, val) {
    var numPut = 0
    if (!(key in map)) {
      map[key] = val
      numPut++
    }

    return Q.resolve(numPut)
  }

  return keep
}

function keeperForData (data) {
  if (!Array.isArray(data)) data = [data]

  return Q.all(data.map(function (d) {
    if (!Buffer.isBuffer(d)) {
      if (typeof d === 'object') d = new Buffer(JSON.stringify(d))
    }

    return Q.ninvoke(utils, 'getInfoHash', d)
  }))
    .then(function (infoHashes) {
      var map = {}
      for (var i = 0; i < infoHashes.length; i++) {
        map[infoHashes[i]] = data[i]
      }

      return keeperForMap(map)
    })
}

function values (obj) {
  var vals = []
  for (var p in obj) {
    if (obj.hasOwnProperty(p)) vals.push(obj[p])
  }

  return vals
}

module.exports = {
  empty: function () {
    return keeperForMap({})
  },
  forMap: keeperForMap,
  forData: keeperForData
}
