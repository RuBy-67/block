const { Blockchain, Transaction } = require("./blockchain");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

// Mon adresse privé
const myKey = ec.keyFromPrivate(
  "7c4c45907dec40c91bab3480c39032e90049f1a44f3e18c3e07c23e3273995cf"
);

// À partir de là, nous pouvons calculer votre clé publique (qui sert également d'adresse de portefeuille)
const myWalletAddress = myKey.getPublic("hex");

// Créer une nouvelle instance de la classe Blockchain
const RuByCoin = new Blockchain();

// miner le 1er block
RuByCoin.minePendingTransactions(myWalletAddress);

// crée la transaction et la signé
const tx1 = new Transaction(myWalletAddress, "address2", 100);
tx1.signTransaction(myKey);
RuByCoin.addTransaction(tx1);

// miné block
RuByCoin.minePendingTransactions(myWalletAddress);

// crée seconde transaction
const tx2 = new Transaction(myWalletAddress, "address1", 50);
tx2.signTransaction(myKey);
RuByCoin.addTransaction(tx2);

// Miné Block
RuByCoin.minePendingTransactions(myWalletAddress);

console.log();
console.log(
  `Balance of RuBy is ${RuByCoin.getBalanceOfAddress(myWalletAddress)}`
);


// Décommentez cette ligne si vous voulez tester la falsification de la chaîne
// RuBy.chain[1].transactions[0].amount = 10;
// verifie si la chaine est valide
console.log();
console.log("Blockchain valid?", RuByCoin.isChainValid() ? "Yes" : "No");
