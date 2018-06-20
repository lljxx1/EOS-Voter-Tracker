var EosApi = require('eosjs-api');
var fs = require('fs');
var stream = require('stream');

var liner = new stream.Transform( { objectMode: true } )

liner._transform = function (chunk, encoding, done) {
  var data = chunk.toString()
  if (this._lastLineData) data = this._lastLineData + data

  var lines = data.split('\n')
  this._lastLineData = lines.splice(lines.length-1,1)[0]

  lines.forEach(this.push.bind(this))
  done()
}

liner._flush = function (done) {
     if (this._lastLineData) this.push(this._lastLineData)
     this._lastLineData = null
     done()
}

function loadFromFile(){
    FILE_PATH = "./block.json";
    var source = fs.createReadStream(FILE_PATH)
    source.pipe(liner)

    liner.on('readable', function () {
        var line
        while (line = liner.read()) {
            parseBlock(line);
        }
    })
}

var API_ENDPOINT =  "http://127.0.0.1:8888";

eos = EosApi({
    httpEndpoint: API_ENDPOINT,
    logger: {
    }
})

eos = EosApi({
    httpEndpoint: API_ENDPOINT,
   logger: {
   }
})

var current = parseInt(fs.readFileSync("./fetched", "utf-8"));

console.log("start fetch block from", current);

function fetchBlock(){
    eos.getBlock(current, (error, result) => {
        if(!error){
            current++;
            try{
                parseBlock(result, true);
                fs.writeFileSync("./fetched", current);
            }catch(e){
                console.log(e, JSON.stringify(result));
                throw e;
            }

        }else{}
        fetchBlock();
    })
}

function listenBlock(){
    fetchBlock();
}



function parseBlock(line, json){
    if(!json){
        try{
            line = JSON.parse(line);
        }catch(e){

        }
    }else{ }
    line.transactions.forEach(function(transaction){
        if(transaction.status != "hard_fail" && typeof transaction.trx != "string"){
            transaction.trx.transaction.actions.forEach(function(action){
                handleAction(action, line);
            })
        }
    })
}


function handleAction(action, block){
    var actionName = action.name;
    try{
        actionHanddler[actionName]  && actionHanddler[actionName](action['data'], block);
    }catch(e){
        console.error("parseActionError", e);
    }
}


function getAccountData(account){
    return new Promise(function(resolve, reject){
        Promise.all([
            eos.getAccount({
                account_name: account
            }),
            eos.getCurrencyBalance({
                code: "eosio.token",
                account: account
            })
        ]).then(function(res){
            res[0].blance = res[1];
            resolve(res[0])
        }, function(err){
            reject(error);
            console.log("error", err);
        }).catch(function(err){
            reject(error);
            console.log("error", err);
        })
    })
}


var actionHanddler = {};


actionHanddler['voteproducer'] = function(data, block){
    var voter = data.voter;
    var producers = data.producers;

    data.block_num = block.block_num;
    data.timestamp = block.timestamp;

    getAccountData(voter).then(function(voterData){
        data.voterData = voterData;
        fs.appendFileSync("./voter.log", JSON.stringify(data)+"\n");
    }, function(err){
        console.log(err);
    }).catch(function(err){
        console.log(err);
    })
}


listenBlock();