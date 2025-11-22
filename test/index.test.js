import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import app from '../src/index.js';

describe('TrackMe Application', () => {
  it('should handle missing auth gracefully', async () => {
    const response = await SELF.fetch('http://localhost/');
    // Without valid auth token, should either redirect to login (302) or show login page (200)
    expect([200, 302]).toContain(response.status);
  });

  it('should render login page', async () => {
    const response = await SELF.fetch('http://localhost/login');
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('TrackMe');
    expect(text).toContain('Usuario');
    expect(text).toContain('Contraseña');
  });

  it('should reject invalid login credentials', async () => {
    const formData = new FormData();
    formData.append('username', 'wrong');
    formData.append('password', 'wrong');
    
    const response = await SELF.fetch('http://localhost/api/login', {
      method: 'POST',
      body: formData,
    });
    
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).toContain('Credenciales inválidas');
  });

  it('should validate input sanitization', async () => {
    const formData = new FormData();
    formData.append('username', '<script>alert("xss")</script>');
    formData.append('password', 'test');
    
    const response = await SELF.fetch('http://localhost/api/login', {
      method: 'POST',
      body: formData,
    });
    
    // Should handle malicious input safely
    expect(response.status).toBe(401);
  });
});
