(function(global){
  var modules = {};

  function require(moduleName){
    if(moduleName){
      var lcmn = moduleName.toLowerCase();
      if(modules.hasOwnProperty(lcmn)){
        var m = modules[lcmn];
        if(!m.exports){
          var modulePrep = {exports:{}};
          m.delegate(modulePrep);
          m.exports = modulePrep.exports;
        }
        return m.exports;
      } else {
        throw new Error('Module not found: ' + moduleName);
      }
    }
    throw new Error('No module requested');
  }

  require.wrapFile = function(moduleName, delegate){
    var lcmn = moduleName.toLowerCase();
    if(modules.hasOwnProperty(lcmn)){
      throw new Error('Module has already been registered');
    }
    var m = (modules[lcmn] = { exports: null, delegate: delegate });
    return m;
  };
  global.require = require;
})(window);

// file: DiceConstant.js
require.wrapFile('./DiceConstant', function(module){
function DiceConstant(val){
  this.results = {
    total: 0
  }
  this.isValid = true;
  this.toString = function(){ return '' + this.results.total; };
  var nval = parseInt(val, 10);
  if(isNaN(nval)){
    this.isValid = false;
  } else {
    this.results.total = nval;
  }
}

module.exports = DiceConstant;
});

// file: DiceExpression.js
require.wrapFile('./DiceExpression', function(module){
var DiceRoll = require('./DiceRoll');
var RollOptions = require('./RollOptions');
var DiceOperator = require('./DiceOperator');
var DiceConstant = require('./DiceConstant');
var specialFunctions = require('./SpecialFunctions');

function validate(){
  var isValid = false;
  if(this.operations && this.operations.length){
    
    var hasRolls = false;
    var operationsValid = this.operations.reduce(function(agg, op){
      if(op instanceof DiceRoll){
        hasRolls = true;
      }
      return agg && op.isValid;
    }, true);
    var validStart = false;
    var validEnd = false;
    
    if(hasRolls){
      validStart = !(this.operations[0] instanceof DiceOperator);
      validEnd = !(this.operations[this.operations.length-1] instanceof DiceOperator);
    }

    isValid = hasRolls && operationsValid && validStart && validEnd;
    
  }
  return isValid;
}

function execute(){
  if(this.isValid){
    var currentTotal = 0;
    var operatorBuffer = null;
    for(var opIndex in this.operations){
      var operation = this.operations[opIndex];
      if(operation instanceof DiceRoll){
        operation.execute();
      }
      if(operation instanceof DiceOperator){
        if(operatorBuffer === null){
          operatorBuffer = operation;
        } else {
          throw new Error('Pre-existing operator');
        }
      } else {
        if(operatorBuffer){
          currentTotal = operatorBuffer.delegate(currentTotal, operation.results.total);
          operatorBuffer = null;
        } else {
          currentTotal = operation.results.total;
        }
      }
    }
    //store the results in a way they can be exposed
    this.result = currentTotal;
    this.details = this.operations.reduce(function(descr, op){
      return descr + op.toString();
    }, '');
  }
}

function toString(){
  if(this.special){
    return this.special;
  } else {
    if(this.isValid){
      return (this.label ? this.label + ': ' : '') + this.result + ' rolls: ' + this.details;
    } else {
      return 'invalid dice roll';
    }
  }
}

function DiceExpression(expr){
  var operations = [];
  var diceNotation = /^\s*([+-])?\s*(\d*)d(\d+|f)([^\s+-]*)/i;
  
  var special = specialFunctions.getSpecial(expr);
  if(special){
    this.special = special;
  } else {
    var srcString = expr;
    while(srcString){
      var match = diceNotation.exec(srcString);
      if(match){
        var operator = match[1];
        var numDice = match[2];
        var numFaces = match[3];
        var options = match[4];
        
        if(operator){
          operations.push(new DiceOperator(operator));
        }
        if(numFaces){
          operations.push(new DiceRoll(numDice, numFaces, options));
        }
        //consume a bit of the string
        srcString = srcString.length > match[0].length ? srcString.substr(match[0].length) : null;
      } else {
        var tailExpression = /\s*([+-])\s*([0-9]+)/i;
        match = tailExpression.exec(srcString);
        if(match){
          var operator = match[1];
          var cval = match[2];
          if(operator){
            operations.push(new DiceOperator(operator));
          }
          if(cval){
            operations.push(new DiceConstant(cval));
          }
        }
        
        var labelExpression = /for\s+(.*)/;
        match = labelExpression.exec(srcString);
        if(match){
          this.label = match[1];
        }
        
        //make sure the loop can exit after looking for constants
        srcString = null;
      }
    }
  }
  this.operations = operations;
  // this.validate = validate.bind(this);
  // this.execute = execute.bind(this);
  this.toString = toString.bind(this);
  
  this.isValid = validate.apply(this);
  if(this.isValid){
    execute.apply(this);
  }
}

module.exports = DiceExpression;
});

// file: DiceOperator.js
require.wrapFile('./DiceOperator', function(module){
function addition(left, right){
  return left + right;
}
function subtraction(left, right){
  var diff = left - right;
  return diff > 0 ? diff : 0;
}

function DiceOperator(op){
  this.operator = op;
  this.isValid = (op === '-' || op === '+');
  this.toString = function() { return ' ' + op + ' '; };
  this.delegate = addition;
  if(this.isValid){
    if(op==='-'){
      this.delegate = subtraction;
    }
  }
}

module.exports = DiceOperator;
});

// file: DiceRoll.js
require.wrapFile('./DiceRoll', function(module){
var RollOptions = require('./RollOptions');

var constantExpressions = {
  'f': function () {
    var sides = [-1, 0, 1];
    var choice = Math.floor(Math.random() * sides.length);
    return sides[choice];
  }
};

function roll(numberOfFaces){
  var primer = new Date().getTime() % 10;
  for(var jk = 0; jk < primer; jk++){
    Math.random();
  }

  if (constantExpressions.hasOwnProperty(numberOfFaces)) {
    return constantExpressions[numberOfFaces]();
  }

  return Math.ceil(numberOfFaces * Math.random());
}

function execute(){
  var d, currentRolls = [];
  if(this.isValid){
    while(currentRolls.length < this.numberOfDice){
      d = roll(this.numberOfFaces);
      this.results.raw.push(d);
      if(!this.rollOptions.needReroll(d)){
        currentRolls.push(d);
      }
    }
    if(this.rollOptions.keep){
      currentRolls.sort();
      var desiredLength = this.rollOptions.keep;
      if(this.rollOptions.lowestRolls){
        currentRolls = currentRolls.slice(0, desiredLength);
      } else {
        currentRolls = currentRolls.slice(currentRolls.length - desiredLength);
      }
    }
    if(this.rollOptions.drop){
      currentRolls.sort();
      var amtToDrop = this.rollOptions.drop;
      if(this.rollOptions.lowestRolls){
        currentRolls = currentRolls.slice(amtToDrop);
      } else {
        currentRolls = currentRolls.slice(0, currentRolls.length - amtToDrop);
      }
    }
    this.results.kept = currentRolls;
    this.results.total = currentRolls.reduce(function(a, b){
      return a + b;
    }, 0);
  }
}

function toString(){
  var niceTryPartner = this.niceTry ? '(nice try)' : '';
  return niceTryPartner + this.numberOfDice + 'd' + this.numberOfFaces + this.rollOptions.toString() + '(' + this.results.total + '=' + this.results.kept.join('+') + ')';
}

function DiceRoll(numDice, numFaces, options){
  if(!numDice) numDice = '1';
  this.numberOfDice = parseInt(numDice, 10);
  if (constantExpressions.hasOwnProperty(numFaces))
    this.numberOfFaces = numFaces;
  else
    this.numberOfFaces = parseInt(numFaces, 10);
  this.rollOptions = new RollOptions(options);
  this.results = {
    raw: [],
    kept: [],
    total: 0
  };
  this.niceTry = false;
  
  if(this.numberOfDice > 1000){
    this.numberOfDice = 1000;
    this.niceTry = true;
  }

  var numFacesAcceptable = (!isNaN(this.numberOfFaces) && this.numberOfFaces > 1) ||
                           constantExpressions.hasOwnProperty(this.numberOfFaces);
  
  this.isValid = !isNaN(this.numberOfDice)
    && numFacesAcceptable
    && this.rollOptions.isValid
    && this.numberOfDice > 0;
    
  this.execute = execute.bind(this);
  this.toString = toString.bind(this);
}

module.exports = DiceRoll;
});

// file: RollOptions.js
require.wrapFile('./RollOptions', function(module){
function createBasicReroll(val){
  return function(diceValue){
    return diceValue === val;
  }
}

function createLessThanReroll(val, lte){
  return function(diceValue){
    if(lte) {
      return diceValue <= val;
    }
    return diceValue < val;
  }
}

function createGreaterThanReroll(val, gte){
  return function(diceValue){
    if(gte) {
      return diceValue >= val;
    }
    return diceValue > val;
  }
}

function needReroll(num){
  var rule;
  for(var jk in this.reroll){
    rule = this.reroll[jk];
    if(rule(num)){
      return true;
    }
  }
  return false;
}

/**
 * Parse the roll options out of the given options string
 */
function RollOptions(options){
  /**
   * If truthy, keep only a certain number of dice from the roll
   */
  this.keep = false;
  /**
   * If truthy, drop a certain number of dice from the roll
   */
  this.drop = false;
  /**
   * If truthy, keep/drop the highest rolls
   */
  this.highestRolls = false;
  /**
   * If truthy, keep/drop the lowest rolls
   */
  this.lowestRolls = false;
  /**
   * Any rules to examine a roll and determine if it should be rerolled
   */
  this.reroll = [];
  /**
   * If these options were parsed successfully
   */
  this.isValid = true;
  /**
   * Determine if a single roll needs to be rerolled by consulting this.reroll
   */
  this.needReroll = needReroll.bind(this);
  
  // r4r2 = reroll 4's and 2's
  // r<3 = reroll anything less than 3
  // r>3 = reroll anything greather than 3
  // k4 or kh4 = keep 4 highest rolls
  // d4 or dl4 = drop 4 lowest rolls
  var optString = options;
  var optionPattern = /^([rkd])([^rkd]+)/i;
  var parseKeepDrop = (function(kd, val, dfltHighest){
    if(val){
      val = val.toLowerCase();
      var kdPattern = /([hl]?)([0-9]+)/i;
      var match = kdPattern.exec(val);
      if(match){
        if(!match[1] && dfltHighest){
          this.highestRolls = true;
        } else if(match[1] === 'h'){
          this.highestRolls = true;
        } else {
          this.lowestRolls = true;
        }
        //make sure the parsed amount of dice is a valid number
        var amt = parseInt(match[2], 10);
        if(isNaN(amt) || !amt){
          this.isValid = false;
        } else {
          this[kd] = amt;
        }
      } else {
        this.isValid = false;
      }
    } else {
      this.isValid = false;
    }
  }).bind(this);
  var parseReroll = (function(val){
    var rerollPattern = /([<>]?)([=]?)([0-9]+)/
    var match = rerollPattern.exec(val);
    if(match){
      var rolledValue = parseInt(match[3], 10);
      if(isNaN(rolledValue) || !rolledValue){
        this.isValid = false;
      } else {
        var thanEquals = false;
        if(match[2]){
          thanEquals = true;
        }
        if(match[1] === '<'){
          this.reroll.push(createLessThanReroll(rolledValue, thanEquals));
        } else if(match[1] === '>') {
          this.reroll.push(createGreaterThanReroll(rolledValue, thanEquals));
        } else {
          this.reroll.push(createBasicReroll(rolledValue));
        }
      }
    } else {
      this.isValid = false;
    }
  }).bind(this);
  while(optString){
    var match = optionPattern.exec(optString);
    if(match){
      var optType = match[1].toLowerCase();
      var optValue = match[2];
      switch(optType){
        case 'r':
          parseReroll(optValue);
          break;
        case 'k':
          if(this.keep || this.drop) this.isValid = false;
          this.keep = true;
          parseKeepDrop('keep', optValue, true);
          break;
        case 'd':
          if(this.keep || this.drop) this.isValid = false;
          this.drop = true;
          parseKeepDrop('drop', optValue, false);
          break;
      }
      //advance the string
      optString = optString.length > match[0].length ? optString.substr(match[0].length) : null;
    } else {
      //no more optionts to find
      optString = null;
    }
  }
  
  //cleanup
  parseKeepDrop = null;
  parseReroll = null;
  optionPattern = null;
  
  this.toString = function(){
    return options;
  };
}

module.exports = RollOptions;
});

// file: SpecialFunctions.js
require.wrapFile('./SpecialFunctions', function(module){
var syntax = [
  'Supports standard dice notation, as well as some extended functionality.',
  'syntax: <roll>[<operator><roll><operator><roll>...][<operator><constant>]',
  'roll: [<number of dice>]d<number of sides>[<modifiers>]',
  '      default number of dice: 1',
  'operator: + or -',
  'constant: any integer',
  'modifiers:',
  '  d<number> - drop the lowest X rolls from this group',
  '  k<number> - keep the highest X rolls from this group',
  '  h - alter either d or k modifier to affect the highest rolls, e.g. dh3: drop the highest 3 rolls',
  '  l - alter either d or k modifier to affect the lowest rolls, e.g. kl2: keep the lowest 2 rolls',
  '  r - reroll based on certain rules',
  '    r4 - reroll all 4s',
  '    r<3 - reroll anything less than 3',
  '    r>=11 - reroll anything greater than or equal to 11',
  'modifiers can be combined, but d and k are mutually exclusive'
].join('\n');

var specialData = {
  barrel: 'Donkey Kong rolls a barrel down the ramp and crushes you. -1000pts',
  rick: 'No.',
  katamari: 'Na naaaaa, na na na na na na, na na Katamari Damacy....',
  help: syntax,
  syntax: syntax
}

function SpecialFunctions(){
  this.getSpecial = function(expression){
    if(expression && specialData.hasOwnProperty(expression)){
      return specialData[expression];
    }
    return null;
  }
}

module.exports = new SpecialFunctions();
});