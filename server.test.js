const request = require('supertest');
const app = require('./server');

const demoCredentials = {
  email: 'da.firmin@example.com',
  password: 'Password123',
};

async function login() {
  const response = await request(app)
    .post('/api/auth/login')
    .send(demoCredentials)
    .expect(200);

  return {
    token: response.body.token,
    user: response.body.user,
  };
}

describe('DiploChain API', () => {

  test('login returns a token and public user data', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send(demoCredentials)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.user.email).toBe(demoCredentials.email);
  });

  test('login rejects invalid email format', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad-email', password: 'Password123' })
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  test('login rejects password too short', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'short' })
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  test('profile route requires a bearer token', async () => {
    await request(app)
      .get('/api/users/usr_da_firmin/profile')
      .expect(401);
  });

  test('profile route returns the authenticated user', async () => {
    const { token, user } = await login();

    const response = await request(app)
      .get(`/api/users/${user.id}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user.id).toBe(user.id);
    expect(response.body.user.password).toBeUndefined();
  });

  test('profile route rejects access to another user profile', async () => {
    const { token } = await login();

    await request(app)
      .get('/api/users/usr_admin/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  test('diplomas route requires auth', async () => {
    await request(app)
      .get('/api/diplomas')
      .expect(401);
  });

  test('private diplomas reject access to another user id', async () => {
    const { token } = await login();

    const response = await request(app)
      .get('/api/diplomas?user=usr_other')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body.success).toBe(false);
  });

  test('diplomas route returns own diplomas', async () => {
    const { token } = await login();

    const response = await request(app)
      .get('/api/diplomas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('public diploma route validates hash format', async () => {
    const response = await request(app)
      .get('/api/public/diplomas/not-a-hash')
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  test('public diploma route returns 404 for unknown valid hash', async () => {
    const response = await request(app)
      .get('/api/public/diplomas/0xdeadbeef12345678deadbeef12345678')
      .expect(404);

    expect(response.body.success).toBe(false);
  });

  test('verify route validates hash format', async () => {
    const response = await request(app)
      .get('/api/verify/not-a-hash')
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  test('health endpoint returns ok', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe('ok');
    expect(response.body.contract).toBe('0xBF0674C9C6582B35Fdbe44ae41f286246A00A43E');
    expect(response.body.blockchain).toBe('Sepolia');
  });

});