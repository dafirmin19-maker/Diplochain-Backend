const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'diplochain-dev-secret-change-me';

// ─── CONFIG BLOCKCHAIN ───────────────────────────────────────────────────────
const INFURA_API_KEY = process.env.INFURA_API_KEY || '319a77a84980452c81ff56e695ffaf2e';
const CONTRACT_ADDRESS = '0xBF0674C9C6582B35Fdbe44ae41f286246A00A43E';

const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "bytes32",  "name": "diplomaHash", "type": "bytes32" },
      { "indexed": false, "internalType": "string",   "name": "studentName", "type": "string"  },
      { "indexed": false, "internalType": "string",   "name": "degreeName",  "type": "string"  },
      { "indexed": false, "internalType": "address",  "name": "issuedBy",    "type": "address" },
      { "indexed": false, "internalType": "uint256",  "name": "issuedAt",    "type": "uint256" }
    ],
    "name": "DiplomaRegistered",
    "type": "event"
  }
];
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ─── STOCKAGE EN MÉMOIRE ─────────────────────────────────────────────────────
let diplomas = [];

// Utilisateurs hardcodés (à remplacer par une vraie DB plus tard)
const users = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
  { id: 2, username: 'etudiant', password: 'etudiant123', role: 'student' },
];
// ─────────────────────────────────────────────────────────────────────────────

// ─── MIDDLEWARE AUTH ──────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── ROUTES AUTH ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});
// ─────────────────────────────────────────────────────────────────────────────

// ─── ROUTES DIPLÔMES ─────────────────────────────────────────────────────────
app.get('/api/diplomas', authenticateToken, (req, res) => {
  res.json({ diplomas, total: diplomas.length });
});

app.get('/api/diplomas/:id', authenticateToken, (req, res) => {
  const diploma = diplomas.find(d => d.id === req.params.id);
  if (!diploma) return res.status(404).json({ error: 'Diplôme non trouvé' });
  res.json({ diploma });
});

// Vérification par hash blockchain
app.get('/api/verify/:hash', (req, res) => {
  const diploma = diplomas.find(d => d.blockchainHash === req.params.hash);
  if (!diploma) return res.status(404).json({ verified: false, error: 'Diplôme non trouvé' });
  res.json({ verified: true, diploma });
});
// ─────────────────────────────────────────────────────────────────────────────

// ─── ROUTE SANTÉ ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    diplomas: diplomas.length,
    blockchain: 'Sepolia',
    contract: CONTRACT_ADDRESS,
  });
});
// ─────────────────────────────────────────────────────────────────────────────

// ─── ÉCOUTE BLOCKCHAIN ───────────────────────────────────────────────────────
async function startBlockchainListener() {
  try {
    const provider = new ethers.JsonRpcProvider(
      `https://sepolia.infura.io/v3/${INFURA_API_KEY}`
    );

    // Vérification de connexion
    const network = await provider.getNetwork();
    console.log(`✅ Connecté à Sepolia (chainId: ${network.chainId})`);

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    // ── Écoute des nouveaux événements en temps réel ──
    contract.on('DiplomaRegistered', (diplomaHash, studentName, degreeName, issuedBy, issuedAt) => {
      console.log(`\n🎓 Nouveau diplôme détecté !`);
      console.log(`   Étudiant : ${studentName}`);
      console.log(`   Diplôme  : ${degreeName}`);
      console.log(`   Hash     : ${diplomaHash}`);

      const newDiploma = {
        id: `diploma_${Date.now()}`,
        title: degreeName,
        studentName,
        degreeName,
        issuedBy,
        blockchainHash: diplomaHash,
        isVerified: true,
        date: new Date(Number(issuedAt) * 1000).toISOString(),
        source: 'blockchain',
      };

      // Éviter les doublons
      const exists = diplomas.find(d => d.blockchainHash === diplomaHash);
      if (!exists) {
        diplomas.push(newDiploma);
        console.log(`✅ Diplôme ajouté (total: ${diplomas.length})`);
      }
    });

    // ── Récupération des événements passés (depuis le début) ──
    console.log('🔍 Récupération des diplômes existants sur la blockchain...');
    const filter = contract.filters.DiplomaRegistered();
    const events = await contract.queryFilter(filter, 0, 'latest');

    for (const event of events) {
      const { diplomaHash, studentName, degreeName, issuedBy, issuedAt } = event.args;
      const exists = diplomas.find(d => d.blockchainHash === diplomaHash);
      if (!exists) {
        diplomas.push({
          id: `diploma_${event.transactionHash}_${event.logIndex}`,
          title: degreeName,
          studentName,
          degreeName,
          issuedBy,
          blockchainHash: diplomaHash,
          isVerified: true,
          date: new Date(Number(issuedAt) * 1000).toISOString(),
          source: 'blockchain_history',
        });
      }
    }

    console.log(`📚 ${events.length} diplôme(s) historique(s) chargé(s)`);
    console.log('👂 En écoute des nouveaux diplômes...\n');

  } catch (error) {
    console.error('❌ Erreur connexion blockchain :', error.message);
    console.log('⚠️  Le serveur continue sans écoute blockchain.');
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── DÉMARRAGE ────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  await startBlockchainListener();
});