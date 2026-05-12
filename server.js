const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'diplochain-dev-secret-change-me';

app.use(cors());
app.use(express.json({ limit: '32kb' }));

const users = [
  {
    id: 'usr_da_firmin',
    fullName: 'Da Firmin',
    email: 'da.firmin@example.com',
    phone: '+226 70 00 00 00',
    institution: 'Universite Polytechnique de Ouagadougou',
    createdAt: new Date('2025-01-12T09:00:00.000Z').toISOString(),
    password: 'Password123',
  },
];

const diplomas = [
  {
    id: '1',
    title: 'Ingenieur Generaliste',
    university: 'Universite Polytechnique de Ouagadougou',
    date: '12 Juillet 2025',
    studentName: 'Da Firmin',
    blockchainHash: '0x71b2a4f9e3c18d5b2a4f9e3c18d5b2a4',
    specialization: 'Genie Informatique',
    mention: 'Tres Bien',
    isVerified: true,
  },
  {
    id: '2',
    title: 'Master en Cybersecurite',
    university: 'Institut Africain des Technologies',
    date: '5 Octobre 2024',
    studentName: 'Da Firmin',
    blockchainHash: '0xabcd1234ef567890abcd1234ef567890',
    specialization: 'Securite des Systemes Distribues',
    mention: 'Bien',
    isVerified: true,
  },
  {
    id: '3',
    title: 'Licence Professionnelle',
    university: 'Universite de Koudougou',
    date: '20 Juin 2022',
    studentName: 'Da Firmin',
    blockchainHash: '0xdeadbeef12345678deadbeef12345678',
    isVerified: true,
  },
];

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const hashRegex = /^0x[a-fA-F0-9]{16,128}$/;
const phoneRegex = /^[0-9+\s().-]{6,30}$/;

function sanitizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidName(value) {
  const text = sanitizeText(value);
  return text.length >= 3 && text.length <= 100;
}

function isValidOptionalText(value, maxLength = 120) {
  if (value === undefined || value === null || value === '') return true;
  const text = sanitizeText(value);
  return text.length > 0 && text.length <= maxLength;
}

function isValidPassword(value) {
  return typeof value === 'string' && value.length >= 8;
}

function isValidEmail(value) {
  return emailRegex.test(sanitizeText(value));
}

function isValidPhone(value) {
  if (value === undefined || value === null || value === '') return true;
  return phoneRegex.test(sanitizeText(value));
}

function toPublicUser(user) {
  const { password, ...publicUser } = user;
  return publicUser;
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '2h' },
  );
}

function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Token d acces requis.',
    });
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_) {
    return res.status(401).json({
      success: false,
      message: 'Token invalide ou expire.',
    });
  }
}

function requireOwnProfile(req, res, next) {
  if (req.auth.sub !== req.params.id) {
    return res.status(403).json({
      success: false,
      message: 'Acces refuse.',
    });
  }
  return next();
}

function findDiplomaByHash(hash) {
  return diplomas.find((diploma) => diploma.blockchainHash === hash);
}

function buildPublicDiplomaUrl(req, hash) {
  return `${req.protocol}://${req.get('host')}/api/public/diplomas/${encodeURIComponent(hash)}`;
}

app.get('/', (req, res) => {
  res.json({
    service: 'DiploChain Backend',
    status: 'running',
    version: '2.1.0',
    endpoints: [
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET  /api/users/:id/profile',
      'PUT  /api/users/:id/profile',
      'GET  /api/diplomas?user=:userId',
      'GET  /api/verify/:hash',
      'GET  /api/public/diplomas/:hash',
    ],
  });
});

app.post('/api/auth/login', (req, res) => {
  const email = sanitizeText(req.body.email).toLowerCase();
  const password = req.body.password;

  if (!isValidEmail(email) || !isValidPassword(password)) {
    return res.status(400).json({
      success: false,
      message: 'Email ou mot de passe invalide.',
    });
  }

  const existingUser = users.find((user) => user.email === email);
  const user = existingUser || users[0];

  return res.json({
    success: true,
    token: issueToken(user),
    user: {
      ...toPublicUser(user),
      email,
    },
  });
});

app.post('/api/auth/register', (req, res) => {
  const fullName = sanitizeText(req.body.fullName);
  const email = sanitizeText(req.body.email).toLowerCase();
  const password = req.body.password;
  const phone = sanitizeText(req.body.phone);
  const institution = sanitizeText(req.body.institution);

  if (!isValidName(fullName) || !isValidEmail(email) || !isValidPassword(password)) {
    return res.status(400).json({
      success: false,
      message: 'Informations de compte invalides.',
    });
  }

  if (!isValidPhone(phone) || !isValidOptionalText(institution)) {
    return res.status(400).json({
      success: false,
      message: 'Profil invalide.',
    });
  }

  if (users.some((user) => user.email === email)) {
    return res.status(409).json({
      success: false,
      message: 'Email deja utilise.',
    });
  }

  const newUser = {
    id: `usr_${Date.now()}`,
    fullName,
    email,
    phone: phone || null,
    institution: institution || null,
    createdAt: new Date().toISOString(),
    password,
  };

  users.push(newUser);

  res.status(201).json({
    success: true,
    token: issueToken(newUser),
    user: toPublicUser(newUser),
  });
});

app.get('/api/users/:id/profile', authenticate, requireOwnProfile, (req, res) => {
  const user = users.find((item) => item.id === req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Utilisateur introuvable.',
    });
  }

  return res.json({
    success: true,
    user: toPublicUser(user),
  });
});

app.put('/api/users/:id/profile', authenticate, requireOwnProfile, (req, res) => {
  const user = users.find((item) => item.id === req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Utilisateur introuvable.',
    });
  }

  const fullName = sanitizeText(req.body.fullName || user.fullName);
  const email = sanitizeText(req.body.email || user.email).toLowerCase();
  const phone = sanitizeText(req.body.phone);
  const institution = sanitizeText(req.body.institution);

  if (!isValidName(fullName) || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Nom ou email invalide.',
    });
  }

  if (!isValidPhone(phone) || !isValidOptionalText(institution)) {
    return res.status(400).json({
      success: false,
      message: 'Profil invalide.',
    });
  }

  user.fullName = fullName;
  user.email = email;
  user.phone = phone || null;
  user.institution = institution || null;

  return res.json({
    success: true,
    user: toPublicUser(user),
  });
});

app.get('/api/diplomas', authenticate, (req, res) => {
  if (req.query.user !== req.auth.sub) {
    return res.status(403).json({
      success: false,
      message: 'Acces refuse.',
    });
  }

  return res.json({
    success: true,
    data: diplomas,
  });
});

app.get('/api/verify/:hash', (req, res) => {
  const hash = decodeURIComponent(req.params.hash || '');
  if (!hashRegex.test(hash)) {
    return res.status(400).json({
      success: false,
      message: 'Hash invalide.',
    });
  }

  return res.json({
    success: true,
    isVerified: Boolean(findDiplomaByHash(hash)),
  });
});

app.get('/api/public/diplomas/:hash', (req, res) => {
  const hash = decodeURIComponent(req.params.hash || '');
  if (!hashRegex.test(hash)) {
    return res.status(400).json({
      success: false,
      message: 'Hash invalide.',
    });
  }

  const diploma = findDiplomaByHash(hash);
  if (!diploma) {
    return res.status(404).json({
      success: false,
      message: 'Diplome introuvable ou non verifie.',
    });
  }

  return res.json({
    success: true,
    data: {
      ...diploma,
      publicVerificationUrl: buildPublicDiplomaUrl(req, hash),
      verifiedAt: new Date().toISOString(),
    },
  });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\nServeur DiploChain demarre sur http://localhost:${PORT}`);
    console.log('Accessible depuis le reseau local sur http://0.0.0.0:' + PORT);
  });
}

module.exports = app;
