const crypto = require("crypto");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const debug = require("debug")("ruby:blockchain");

class Transaction {
  /**
   * @param {string} fromAddress
   * @param {string} toAddress
   * @param {number} amount
   */
  constructor(fromAddress, toAddress, amount) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.timestamp = Date.now();
  }

  /**
   * Créée le SHA256 hash pour la transaction
   *
   * @returns {string}
   */
  calculateHash() {
    return crypto
      .createHash("sha256")
      .update(this.fromAddress + this.toAddress + this.amount + this.timestamp)
      .digest("hex");
  }

  /**
   * Signe une transaction avec la signature de clé donnée (qui est une paire de clés elliptique
   * objet qui contient une clé privée). La signature est alors stockée à l'intérieur de
   * l'objet de transaction et stocké plus tard sur la blockchain.
   *
   * @param {string} signingKey
   */
  signTransaction(signingKey) {
    // Vous ne pouvez envoyer une transaction qu'à partir du portefeuille lié à votre
    // clé. Nous vérifions donc ici si l'adresse fromAddress correspond à votre clé publique
    if (signingKey.getPublic("hex") !== this.fromAddress) {
      throw new Error("You cannot sign transactions for other wallets!");
    }

    // Calculer le hachage de cette transaction, la signer avec la clé
    // et le stocke dans l'objet de transaction
    const hashTx = this.calculateHash();
    const sig = signingKey.sign(hashTx, "base64");

    this.signature = sig.toDER("hex");
  }

  /**
   * Vérifie si la signature est valide (la transaction n'a pas été falsifiée).
   * Il utilise la fromAddress comme clé publique.
   *
   * @returns {boolean}
   */
  isValid() {
    // Si la transaction n'a pas d'adresse d'origine, nous supposons qu'il s'agit d'une
    // récompense minière et qu'elle est valide. Vous pouvez le vérifier d'une
    // manière différente (champ spécial par exemple)
    if (this.fromAddress === null) return true;

    if (!this.signature || this.signature.length === 0) {
      throw new Error("No signature in this transaction");
    }

    const publicKey = ec.keyFromPublic(this.fromAddress, "hex");
    return publicKey.verify(this.calculateHash(), this.signature);
  }
}

class Block {
  /**
   * @param {number} timestamp
   * @param {Transaction[]} transactions
   * @param {string} previousHash
   */
  constructor(timestamp, transactions, previousHash = "") {
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  /**
   *Renvoie le SHA256 de ce bloc (en traitant toutes les données stockées
   * à l'intérieur de ce bloc)
   *
   * @returns {string}
   */
  calculateHash() {
    return crypto
      .createHash("sha256")
      .update(
        this.previousHash +
          this.timestamp +
          JSON.stringify(this.transactions) +
          this.nonce
      )
      .digest("hex");
  }

  /**
   * Démarre le processus de minage sur le bloc. Il change le 'nonce' jusqu'au hachage
   * du bloc commence avec suffisamment de zéros (= difficulté)
   *
   * @param {number} difficulty
   */
  mineBlock(difficulty) {
    while (
      this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")
    ) {
      this.nonce++;
      this.hash = this.calculateHash();
    }

    debug(`Block mined: ${this.hash}`);
  }

  /**
   * Valide toutes les transactions à l'intérieur de ce bloc (signature + hachage) et
   * renvoie true si tout est vérifié. False si le bloc est invalide.
   *
   * @returns {boolean}
   */
  hasValidTransactions() {
    for (const tx of this.transactions) {
      if (!tx.isValid()) {
        return false;
      }
    }

    return true;
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2;
    this.pendingTransactions = [];
    this.miningReward = 100;
  }

  /**
   * @returns {Block}
   */
  createGenesisBlock() {
    return new Block(Date.parse("2017-01-01"), [], "0");
  }

  /**
   * Renvoie le dernier bloc de notre chaîne. Utile lorsque vous souhaitez créer un
   * nouveau bloc et vous avez besoin du hachage du bloc précédent.
   *
   * @returns {Block[]}
   */
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Prend toutes les transactions en attente, les met dans un bloc et démarre le
   * processus d'extraction. Il ajoute également une transaction pour envoyer la récompense minière à
   * l'adresse indiquée.
   *
   * @param {string} miningRewardAddress
   */
  minePendingTransactions(miningRewardAddress) {
    const rewardTx = new Transaction(
      null,
      miningRewardAddress,
      this.miningReward
    );
    this.pendingTransactions.push(rewardTx);

    const block = new Block(
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );
    block.mineBlock(this.difficulty);

    debug("Block successfully mined!");
    this.chain.push(block);

    this.pendingTransactions = [];
  }

  /**
   Ajouter une nouvelle transaction à la liste des transactions en attente (à ajouter
   * la prochaine fois que le processus de minage démarre). Cela vérifie que la donnée
   * la transaction est correctement signée
   *
   * @param {Transaction} transaction
   */
  addTransaction(transaction) {
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error("Transaction must include from and to address");
    }

    // Verification de la transaction
    if (!transaction.isValid()) {
      throw new Error("Cannot add invalid transaction to chain");
    }

    if (transaction.amount <= 0) {
      throw new Error("Transaction amount should be higher than 0");
    }

    // S'assurer que le montant envoyé n'est pas supérieur au solde existant
    if (
      this.getBalanceOfAddress(transaction.fromAddress) < transaction.amount
    ) {
      throw new Error("Not enough balance");
    }

    this.pendingTransactions.push(transaction);
    debug("transaction added: %s", transaction);
  }

  /**
   * Renvoie le solde d'une adresse de portefeuille donnée.

   *
   * @param {string} address
   * @returns {number} balance du wallet
   */
  getBalanceOfAddress(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) {
          balance -= trans.amount;
        }

        if (trans.toAddress === address) {
          balance += trans.amount;
        }
      }
    }

    debug("getBalanceOfAdrees: %s", balance);
    return balance;
  }

  /**
   * de toutes les transactions qui se sont produites
   * vers et depuis l'adresse de portefeuille donnée.
   *
   * @param  {string} address
   * @return {Transaction[]}
   */
  getAllTransactionsForWallet(address) {
    const txs = [];

    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.fromAddress === address || tx.toAddress === address) {
          txs.push(tx);
        }
      }
    }

    debug("get transactions for wallet count: %s", txs.length);
    return txs;
  }

  /**
   * Boucle sur tous les blocs de la chaîne et vérifie s'ils sont correctement
   * liés ensemble et personne n'a falsifié les hachages. En vérifiant
   * les blocs, il vérifie également les transactions (signées) à l'intérieur de ceux-ci.
   *
   * @returns {boolean}
   */
  isChainValid() {
    // Vérifiez si le bloc Genesis n'a pas été falsifié en comparant
    // la sortie de createGenesisBlock avec le premier bloc de notre chaîne
    const realGenesis = JSON.stringify(this.createGenesisBlock());

    if (realGenesis !== JSON.stringify(this.chain[0])) {
      return false;
    }

    // Vérifiez les blocs restants sur la chaîne pour voir s'il y a des hachages et
    // les signatures sont correctes
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (previousBlock.hash !== currentBlock.previousHash) {
        return false;
      }

      if (!currentBlock.hasValidTransactions()) {
        return false;
      }

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }
    }

    return true;
  }
}

module.exports.Blockchain = Blockchain;
module.exports.Block = Block;
module.exports.Transaction = Transaction;
