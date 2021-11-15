const EC = require("elliptic").ec;

// Vous pouvez utiliser n'importe quelle courbe elliptique que vous voulez
const ec = new EC("secp256k1");

// Générer une nouvelle paire de clés et les convertir en chaînes hexadécimales
const key = ec.genKeyPair();
const publicKey = key.getPublic("hex");
const privateKey = key.getPrivate("hex");

// Imprime les clés sur la console
console.log();
console.log(
  "Your public key (also your wallet address, freely shareable)\n",
  publicKey
);

console.log();
console.log(
  "Your private key (keep this secret! To sign transactions)\n",
  privateKey
);
