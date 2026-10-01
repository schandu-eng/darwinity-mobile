import assert from 'node:assert/strict'
import {
  blanksAllFilled,
  joinBlankAnswers,
  parseFillBlankParts,
  splitBlankAnswers,
  splitCorrectAnswers,
} from './fillBlank.js'

const one = parseFillBlankParts('The capital of France is ____.')
assert.equal(one.blankCount, 1)
assert.equal(one.implicitBlank, false)
assert.equal(one.parts.filter((p) => p.type === 'blank').length, 1)

const multi = parseFillBlankParts('____ and ____ make water.')
assert.equal(multi.blankCount, 2)

const none = parseFillBlankParts('Name the process.')
assert.equal(none.blankCount, 1)
assert.equal(none.implicitBlank, true)

assert.equal(joinBlankAnswers(['foo']), 'foo')
assert.equal(joinBlankAnswers(['a', 'b']), 'a | b')
assert.deepEqual(splitBlankAnswers('a | b', 2), ['a', 'b'])
assert.equal(blanksAllFilled('a | ', 2), false)
assert.equal(blanksAllFilled('a | b', 2), true)

assert.deepEqual(splitCorrectAnswers('resilience', 1), ['resilience'])
assert.deepEqual(splitCorrectAnswers('alpha|beta', 2), ['alpha', 'beta'])
assert.deepEqual(splitCorrectAnswers('only one', 2), ['only one', ''])

console.log('fillBlank tests ok')
