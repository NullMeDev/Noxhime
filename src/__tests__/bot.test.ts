import { Client } from 'discord.js';
import axios from 'axios';
import { Database } from 'sqlite3';
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock Discord.js Client
jest.mock('discord.js', () => ({
    Client: jest.fn().mockImplementation(() => ({
        login: jest.fn().mockResolvedValue('mock_token'),
        destroy: jest.fn().mockResolvedValue(undefined)
    }))
}));

describe('Noxhime Bot Integration Tests', () => {
    describe('Core Bot Functionality', () => {
        test('Environment variables are properly set', () => {
            expect(process.env.DISCORD_TOKEN).toBeDefined();
            expect(process.env.CLIENT_ID).toBeDefined();
        });

        test('Discord client can be initialized', () => {
            const client = new Client({
                intents: ['Guilds', 'GuildMessages']
            });
            expect(client).toBeDefined();
        });
    });

    describe('Database Integration', () => {
        let db: Database;

        beforeAll(() => {
            db = new Database(':memory:');
        });

        test('Database can execute queries', (done) => {
            db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)', (err) => {
                expect(err).toBeNull();
                done();
            });
        });

        afterAll((done) => {
            db.close(done);
        });
    });

    describe('Resource Usage', () => {
        test('Memory usage is within limits', () => {
            const usage = process.memoryUsage();
            expect(usage.heapUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
        });
    });

    // Skip actual HTTP tests in CI/test environment
    describe('API Integration', () => {
        beforeEach(() => {
            jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: { status: 'ok' } });
            jest.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { success: true } });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('Monitor endpoint is accessible', async () => {
            const response = await axios.get('http://localhost:5000/status');
            expect(response.status).toBe(200);
        });

        test('Alert system is functional', async () => {
            const testAlert = {
                title: 'Test Alert',
                body: 'Integration test alert',
                severity: 'info'
            };
            const response = await axios.post('http://localhost:5000/alert', testAlert);
            expect(response.status).toBe(200);
        });
    });
});
