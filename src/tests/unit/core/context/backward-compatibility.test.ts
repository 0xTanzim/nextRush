/**
 * Test: Backward Compatibility Verification
 * Proves both old and new syntax work identically
 */

import { createContext } from '@/core/app/context';
import { describe, expect, it, vi } from 'vitest';

describe('🔄 Backward Compatibility: Old vs New Syntax', () => {
  it('should work with OLD syntax: ctx.res.json()', async () => {
    // Create mock request/response
    const mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
    } as any;

    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      headersSent: false,
      finished: false,
      statusCode: 200,
    } as any;

    const options = {};

    // Create context
    const ctx = createContext(mockReq, mockRes, options);

    // ✅ OLD WAY - should work
    ctx.res.json({ users: [], method: 'old' });

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json'
    );
    expect(mockRes.end).toHaveBeenCalledWith(
      JSON.stringify({ users: [], method: 'old' })
    );
  });

  it('should work with NEW syntax: ctx.json()', async () => {
    // Create mock request/response
    const mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
    } as any;

    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      headersSent: false,
      finished: false,
      statusCode: 200,
    } as any;

    const options = {};

    // Create context
    const ctx = createContext(mockReq, mockRes, options);

    // ✅ NEW WAY - should work identically
    ctx.json({ users: [], method: 'new' });

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json'
    );
    expect(mockRes.end).toHaveBeenCalledWith(
      JSON.stringify({ users: [], method: 'new' })
    );
  });

  it('should work with OLD syntax: ctx.res.redirect()', async () => {
    const mockReq = { method: 'GET', url: '/test', headers: {} } as any;
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      headersSent: false,
      finished: false,
      statusCode: 200,
    } as any;
    const options = {};

    const ctx = createContext(mockReq, mockRes, options);

    // ✅ OLD WAY
    ctx.res.redirect('/login');

    expect(mockRes.statusCode).toBe(302);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Location', '/login');
    expect(mockRes.end).toHaveBeenCalled();
  });

  it('should work with NEW syntax: ctx.redirect()', async () => {
    const mockReq = { method: 'GET', url: '/test', headers: {} } as any;
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
      headersSent: false,
      finished: false,
      statusCode: 200,
    } as any;
    const options = {};

    const ctx = createContext(mockReq, mockRes, options);

    // ✅ NEW WAY
    ctx.redirect('/login');

    expect(mockRes.statusCode).toBe(302);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Location', '/login');
    expect(mockRes.end).toHaveBeenCalled();
  });

  it('should work with OLD syntax: ctx.res.cookie()', async () => {
    const mockReq = { method: 'GET', url: '/test', headers: {} } as any;
    const mockRes = {
      setHeader: vi.fn(),
      getHeader: vi.fn().mockReturnValue(undefined),
      end: vi.fn(),
      headersSent: false,
      finished: false,
      statusCode: 200,
    } as any;
    const options = {};

    const ctx = createContext(mockReq, mockRes, options);

    // ✅ OLD WAY
    ctx.res.cookie('sessionId', '123', { httpOnly: true });

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('sessionId=123')
    );
  });

  it('should work with NEW syntax: ctx.cookie()', async () => {
    const mockReq = { method: 'GET', url: '/test', headers: {} } as any;
    const mockRes = {
      setHeader: vi.fn(),
      getHeader: vi.fn().mockReturnValue(undefined),
      end: vi.fn(),
      headersSent: false,
      finished: false,
      statusCode: 200,
    } as any;
    const options = {};

    const ctx = createContext(mockReq, mockRes, options);

    // ✅ NEW WAY
    ctx.cookie('sessionId', '456', { httpOnly: true });

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('sessionId=456')
    );
  });

  it('should demonstrate both approaches work in same context', async () => {
    const mockReq = { method: 'GET', url: '/test', headers: {} } as any;
    const mockRes = {
      setHeader: vi.fn(),
      getHeader: vi.fn().mockReturnValue(undefined),
      end: vi.fn(),
      headersSent: false,
      finished: false,
      statusCode: 200,
    } as any;
    const options = {};

    const ctx = createContext(mockReq, mockRes, options);

    // ✅ Mix old and new - both work perfectly!
    ctx.res.cookie('oldWay', 'value1'); // OLD syntax
    ctx.cookie('newWay', 'value2'); // NEW syntax
    ctx.status = 201; // Direct property
    ctx.res.set('X-Old', 'header1'); // OLD syntax
    ctx.json({ mixed: 'approach' }); // NEW syntax

    // Verify everything worked
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('oldWay=value1')
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('newWay=value2')
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Old', 'header1');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json'
    );
    expect(mockRes.end).toHaveBeenCalledWith(
      JSON.stringify({ mixed: 'approach' })
    );
    expect(ctx.status).toBe(201);
  });
});
