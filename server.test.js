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

  test('login rejects invalid input', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad-email', password: 'short' })
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

  test('private diplomas reject another user id', async () => {
    const { token } = await login();

    await request(app)
      .get('/api/diplomas?user=usr_other')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  test('public diploma route validates hash format', async () => {
    const response = await request(app)
      .get('/api/public/diplomas/not-a-hash')
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  test('public diploma route returns a verified diploma', async () => {
    const hash = '0x71b2a4f9e3c18d5b2a4f9e3c18d5b2a4';

    const response = await request(app)
      .get(`/api/public/diplomas/${hash}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.blockchainHash).toBe(hash);
    expect(response.body.data.publicVerificationUrl).toContain(
      `/api/public/diplomas/${hash}`,
    );
  });
});
