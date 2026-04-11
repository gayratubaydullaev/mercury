import { isProductionLike } from './deployment-env';

describe('isProductionLike', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.APP_ENV;
    delete process.env.VERCEL_ENV;
    delete process.env.FORCE_DISABLE_DEV_ENDPOINTS;
  });

  it('is true when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.APP_ENV;
    delete process.env.VERCEL_ENV;
    delete process.env.FORCE_DISABLE_DEV_ENDPOINTS;
    expect(isProductionLike()).toBe(true);
  });

  it('is true when APP_ENV is production', () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_ENV = 'production';
    delete process.env.VERCEL_ENV;
    delete process.env.FORCE_DISABLE_DEV_ENDPOINTS;
    expect(isProductionLike()).toBe(true);
  });

  it('is true when FORCE_DISABLE_DEV_ENDPOINTS is true', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.APP_ENV;
    process.env.FORCE_DISABLE_DEV_ENDPOINTS = 'true';
    expect(isProductionLike()).toBe(true);
  });

  it('is false for plain development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.APP_ENV;
    delete process.env.VERCEL_ENV;
    delete process.env.FORCE_DISABLE_DEV_ENDPOINTS;
    expect(isProductionLike()).toBe(false);
  });
});
