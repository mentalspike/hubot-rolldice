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