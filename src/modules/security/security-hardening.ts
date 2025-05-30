import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = util.promisify(exec);

/**
 * Interface for hardening check result
 */
interface HardeningCheck {
    id: string;
    name: string;
    category: string;
    status: 'pass' | 'fail' | 'warning' | 'not-applicable';
    description: string;
    remediation?: string;
    automatic_fix?: boolean;
    fix_command?: string;
    cis_benchmark?: string;
    nist_control?: string;
}

/**
 * Interface for hardening task result
 */
interface HardeningTaskResult {
    task: string;
    status: 'success' | 'failure' | 'skipped';
    details: string;
    command?: string;
    output?: string;
    error?: string;
}

/**
 * Interface for full hardening result
 */
interface HardeningResult {
    timestamp: Date;
    system: string;
    os_type: string;
    os_version: string;
    checks: HardeningCheck[];
    tasks_performed: HardeningTaskResult[];
    summary: {
        total_checks: number;
        passed: number;
        failed: number;
        warnings: number;
        not_applicable: number;
        fixes_applied: number;
        fixes_failed: number;
    };
    duration: number;
    profile: string;
}

/**
 * Class for security hardening operations
 */
export class SecurityHardening {
    private client: Client;
    private notifyChannelId: string;
    private logEvent: (type: string, description: string) => Promise<boolean>;
    private isHardening: boolean = false;
    private resultsDir: string;
    private benchmarks: Map<string, any> = new Map();
    private osType: 'ubuntu' | 'debian' | 'centos' | 'rhel' | 'fedora' | 'generic' = 'generic';
    private osVersion: string = '';

    constructor(
        client: Client,
        notifyChannelId: string,
        logEvent: (type: string, description: string) => Promise<boolean>,
        resultsDir?: string
    ) {
        this.client = client;
        this.notifyChannelId = notifyChannelId;
        this.logEvent = logEvent;
        
        // Set up results directory
        this.resultsDir = resultsDir || path.join(process.cwd(), 'data', 'security-hardening');
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    /**
     * Initialize the security hardening system
     */
    public async initialize(): Promise<boolean> {
        try {
            console.log('Initializing security hardening system...');
            
            // Detect OS type and version
            await this.detectOSInfo();
            
            // Load appropriate benchmarks
            await this.loadBenchmarks();
            
            console.log(`Security hardening initialized for ${this.osType} ${this.osVersion}`);
            await this.logEvent('SECURITY', `Security hardening system initialized for ${this.osType} ${this.osVersion}`);
            
            return true;
        } catch (error) {
            console.error('Error initializing security hardening:', error);
            return false;
        }
    }

    /**
     * Detect OS type and version
     */
    private async detectOSInfo(): Promise<void> {
        try {
            // Check if /etc/os-release exists (most modern Linux distros)
            if (fs.existsSync('/etc/os-release')) {
                const { stdout: osRelease } = await execAsync('cat /etc/os-release');
                
                // Extract OS information
                if (osRelease.includes('ubuntu')) {
                    this.osType = 'ubuntu';
                    const versionMatch = osRelease.match(/VERSION_ID="?([0-9.]+)"?/);
                    this.osVersion = versionMatch ? versionMatch[1] : '';
                } else if (osRelease.includes('debian')) {
                    this.osType = 'debian';
                    const versionMatch = osRelease.match(/VERSION_ID="?([0-9.]+)"?/);
                    this.osVersion = versionMatch ? versionMatch[1] : '';
                } else if (osRelease.includes('centos')) {
                    this.osType = 'centos';
                    const versionMatch = osRelease.match(/VERSION_ID="?([0-9.]+)"?/);
                    this.osVersion = versionMatch ? versionMatch[1] : '';
                } else if (osRelease.includes('rhel')) {
                    this.osType = 'rhel';
                    const versionMatch = osRelease.match(/VERSION_ID="?([0-9.]+)"?/);
                    this.osVersion = versionMatch ? versionMatch[1] : '';
                } else if (osRelease.includes('fedora')) {
                    this.osType = 'fedora';
                    const versionMatch = osRelease.match(/VERSION_ID="?([0-9.]+)"?/);
                    this.osVersion = versionMatch ? versionMatch[1] : '';
                } else {
                    this.osType = 'generic';
                    this.osVersion = '';
                }
            } else {
                // Fallback detection methods
                try {
                    const { stdout: unameOutput } = await execAsync('uname -a');
                    if (unameOutput.toLowerCase().includes('darwin')) {
                        this.osType = 'generic'; // macOS
                        this.osVersion = 'macOS';
                    } else {
                        this.osType = 'generic';
                        this.osVersion = 'Unknown Linux';
                    }
                } catch (error) {
                    this.osType = 'generic';
                    this.osVersion = 'Unknown';
                }
            }
            
            console.log(`Detected OS: ${this.osType} ${this.osVersion}`);
        } catch (error) {
            console.error('Error detecting OS information:', error);
            this.osType = 'generic';
            this.osVersion = 'Unknown';
        }
    }

    /**
     * Load security benchmarks
     */
    private async loadBenchmarks(): Promise<void> {
        // Create generic benchmark as fallback
        const genericBenchmark = this.generateGenericBenchmark();
        this.benchmarks.set('cis-level1', genericBenchmark.cis.level1);
        this.benchmarks.set('cis-level2', genericBenchmark.cis.level2);
        this.benchmarks.set('nist', genericBenchmark.nist);
        this.benchmarks.set('pci-dss', genericBenchmark.pci);
        
        console.log(`Loaded ${this.benchmarks.size} security benchmark profiles`);
    }

    /**
     * Generate a generic security benchmark for Linux systems
     */
    private generateGenericBenchmark(): any {
        // This is a simplified example. A real benchmark would be much more comprehensive.
        return {
            cis: {
                level1: [
                    {
                        id: 'cis-1.1.1',
                        name: 'Ensure mounting of cramfs filesystems is disabled',
                        category: 'filesystem',
                        check_command: "modprobe -n -v cramfs | grep -E '(cramfs|install)'",
                        expected_output: 'install /bin/true',
                        fix_command: "echo 'install cramfs /bin/true' > /etc/modprobe.d/cramfs.conf",
                        remediation: "Add 'install cramfs /bin/true' to /etc/modprobe.d/cramfs.conf",
                        cis_benchmark: '1.1.1',
                        automatic_fix: true
                    },
                    {
                        id: 'cis-5.2.1',
                        name: 'Ensure permissions on /etc/ssh/sshd_config are configured',
                        category: 'ssh',
                        check_command: "stat /etc/ssh/sshd_config",
                        expected_regex: 'Access: \\(0[6-7]00\\/.*\\) Uid: \\(\\s*0\\/\\s*root\\)',
                        fix_command: "chmod 0600 /etc/ssh/sshd_config",
                        remediation: "Run: chmod 0600 /etc/ssh/sshd_config",
                        cis_benchmark: '5.2.1',
                        automatic_fix: true
                    }
                ],
                level2: [
                    {
                        id: 'cis-5.2.13',
                        name: 'Ensure only strong ciphers are used',
                        category: 'ssh',
                        check_command: "grep 'Ciphers' /etc/ssh/sshd_config",
                        expected_regex: 'chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr',
                        fix_command: "echo 'Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr' >> /etc/ssh/sshd_config",
                        remediation: "Edit /etc/ssh/sshd_config and add: Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr",
                        cis_benchmark: '5.2.13',
                        automatic_fix: true
                    }
                ]
            },
            nist: [
                // NIST 800-53 controls
                {
                    id: 'nist-ac-2',
                    name: 'Account Management',
                    category: 'access_control',
                    check_command: "grep '^PASS_MAX_DAYS' /etc/login.defs",
                    expected_regex: '^PASS_MAX_DAYS\\s+90',
                    fix_command: "sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS 90/' /etc/login.defs",
                    remediation: "Edit /etc/login.defs and set PASS_MAX_DAYS to 90",
                    nist_control: 'AC-2',
                    automatic_fix: true
                }
            ],
            pci: [
                // PCI DSS requirements
                {
                    id: 'pci-2.2.2',
                    name: 'Disable unnecessary services',
                    category: 'services',
                    check_command: "systemctl is-enabled telnet.service rsh.service rlogin.service",
                    expected_output: '',
                    fix_command: "systemctl disable telnet.service rsh.service rlogin.service",
                    remediation: "Disable insecure services: telnet, rsh, rlogin",
                    pci_requirement: '2.2.2',
                    automatic_fix: true
                }
            ]
        };
    }

    /**
     * Run a security check/audit without applying fixes
     */
    public async runSecurityCheck(
        profile: 'cis-level1' | 'cis-level2' | 'nist' | 'pci-dss' = 'cis-level1'
    ): Promise<HardeningResult> {
        console.log(`Running security check with profile: ${profile}`);
        await this.logEvent('SECURITY_CHECK', `Starting security check with profile ${profile}`);
        
        return this.runHardening(profile, false);
    }

    /**
     * Run a security hardening operation with fixes
     */
    public async runHardening(
        profile: 'cis-level1' | 'cis-level2' | 'nist' | 'pci-dss' = 'cis-level1',
        applyFixes: boolean = true
    ): Promise<HardeningResult> {
        if (this.isHardening) {
            throw new Error('A security hardening operation is already in progress');
        }
        
        this.isHardening = true;
        const startTime = Date.now();
        
        try {
            console.log(`Running security hardening with profile ${profile}, applyFixes=${applyFixes}`);
            await this.logEvent('SECURITY_HARDENING', `Starting security hardening with profile ${profile}${applyFixes ? ' (with fixes)' : ' (check only)'}`);
            
            // Get the appropriate benchmark
            const benchmark = this.benchmarks.get(profile) || [];
            
            if (benchmark.length === 0) {
                throw new Error(`Security benchmark profile '${profile}' not found or empty`);
            }
            
            // Initialize result
            const result: HardeningResult = {
                timestamp: new Date(),
                system: os.hostname(),
                os_type: this.osType,
                os_version: this.osVersion,
                checks: [],
                tasks_performed: [],
                summary: {
                    total_checks: 0,
                    passed: 0,
                    failed: 0,
                    warnings: 0,
                    not_applicable: 0,
                    fixes_applied: 0,
                    fixes_failed: 0,
                },
                duration: 0,
                profile
            };
            
            // Run each check in the benchmark
            for (const check of benchmark) {
                try {
                    console.log(`Running check: ${check.id} - ${check.name}`);
                    
                    // Skip checks that don't have a check command
                    if (!check.check_command) {
                        result.checks.push({
                            id: check.id,
                            name: check.name,
                            category: check.category,
                            status: 'not-applicable',
                            description: 'Check skipped - no check command',
                            cis_benchmark: check.cis_benchmark,
                            nist_control: check.nist_control
                        });
                        result.summary.not_applicable++;
                        continue;
                    }
                    
                    // Run the check command
                    let checkPassed = false;
                    let checkOutput = '';
                    let checkError = '';
                    
                    try {
                        const { stdout, stderr } = await execAsync(check.check_command);
                        checkOutput = stdout.trim();
                        checkError = stderr.trim();
                        
                        // Determine if check passed based on expected output or regex
                        if (check.expected_output !== undefined) {
                            checkPassed = checkOutput === check.expected_output;
                        } else if (check.expected_regex !== undefined) {
                            const regex = new RegExp(check.expected_regex);
                            checkPassed = regex.test(checkOutput);
                        } else if (check.expected_status !== undefined) {
                            // Command ran successfully, so exit code was 0
                            checkPassed = true;
                        } else {
                            // No expected output/regex/status defined, assume success if command ran
                            checkPassed = true;
                        }
                    } catch (error: any) {
                        checkError = error.message || 'Unknown error';
                        
                        // Some checks expect command to fail
                        if (check.expected_status !== undefined && error.code !== undefined) {
                            checkPassed = error.code === check.expected_status;
                        } else {
                            checkPassed = false;
                        }
                        
                        // If stderr is available, use it
                        if (error.stderr) {
                            checkError = error.stderr.trim();
                        }
                        
                        // If stdout is available, use it for output
                        if (error.stdout) {
                            checkOutput = error.stdout.trim();
                        }
                    }
                    
                    // Create the check result
                    const checkResult: HardeningCheck = {
                        id: check.id,
                        name: check.name,
                        category: check.category,
                        status: checkPassed ? 'pass' : 'fail',
                        description: checkPassed ? 'Check passed' : `Check failed: ${checkError || 'Did not match expected result'}`,
                        remediation: check.remediation,
                        automatic_fix: check.automatic_fix,
                        fix_command: check.fix_command,
                        cis_benchmark: check.cis_benchmark,
                        nist_control: check.nist_control
                    };
                    
                    result.checks.push(checkResult);
                    
                    // Update summary
                    result.summary.total_checks++;
                    if (checkPassed) {
                        result.summary.passed++;
                    } else {
                        result.summary.failed++;
                        
                        // Apply fix if enabled and available
                        if (applyFixes && check.automatic_fix && check.fix_command) {
                            try {
                                console.log(`Applying fix for ${check.id}: ${check.fix_command}`);
                                
                                const { stdout, stderr } = await execAsync(check.fix_command);
                                
                                result.tasks_performed.push({
                                    task: `Fix for ${check.id}: ${check.name}`,
                                    status: 'success',
                                    details: 'Fix applied successfully',
                                    command: check.fix_command,
                                    output: stdout.trim(),
                                    error: stderr.trim()
                                });
                                
                                result.summary.fixes_applied++;
                                
                                // Verify the fix
                                let verifyPassed = false;
                                try {
                                    const { stdout: verifyOut } = await execAsync(check.check_command);
                                    
                                    if (check.expected_output !== undefined) {
                                        verifyPassed = verifyOut.trim() === check.expected_output;
                                    } else if (check.expected_regex !== undefined) {
                                        const regex = new RegExp(check.expected_regex);
                                        verifyPassed = regex.test(verifyOut.trim());
                                    } else {
                                        verifyPassed = true;
                                    }
                                    
                                    if (verifyPassed) {
                                        // Update the check status
                                        checkResult.status = 'pass';
                                        checkResult.description = 'Check passed after fix was applied';
                                        
                                        // Update summary
                                        result.summary.passed++;
                                        result.summary.failed--;
                                    }
                                } catch (error) {
                                    // Verification failed
                                }
                            } catch (error: any) {
                                console.error(`Error applying fix for ${check.id}:`, error);
                                
                                result.tasks_performed.push({
                                    task: `Fix for ${check.id}: ${check.name}`,
                                    status: 'failure',
                                    details: `Failed to apply fix: ${error.message || 'Unknown error'}`,
                                    command: check.fix_command,
                                    error: error.stderr || error.message || 'Unknown error'
                                });
                                
                                result.summary.fixes_failed++;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing check ${check.id}:`, error);
                    result.checks.push({
                        id: check.id,
                        name: check.name,
                        category: check.category,
                        status: 'warning',
                        description: `Error running check: ${error instanceof Error ? error.message : String(error)}`,
                        cis_benchmark: check.cis_benchmark,
                        nist_control: check.nist_control
                    });
                    result.summary.warnings++;
                }
            }
            
            // Calculate duration
            const endTime = Date.now();
            result.duration = Math.round((endTime - startTime) / 1000);
            
            // Send report
            await this.reportHardeningResults(result, applyFixes);
            
            console.log(`Security hardening completed in ${result.duration} seconds. ${result.summary.passed}/${result.summary.total_checks} checks passed.`);
            await this.logEvent('SECURITY_HARDENING', 
                `Security hardening completed: ${result.summary.passed}/${result.summary.total_checks} checks passed, ` +
                `${applyFixes ? `${result.summary.fixes_applied} fixes applied` : 'no fixes applied'}`);
            
            return result;
        } catch (error) {
            console.error('Error during security hardening:', error);
            await this.logEvent('ERROR', `Security hardening failed: ${error instanceof Error ? error.message : String(error)}`);
            
            throw error;
        } finally {
            this.isHardening = false;
        }
    }

    /**
     * Report hardening results to Discord
     */
    private async reportHardeningResults(result: HardeningResult, applyFixes: boolean): Promise<void> {
        try {
            if (!this.client.isReady() || !this.notifyChannelId) return;
            
            const channel = await this.client.channels.fetch(this.notifyChannelId);
            if (!channel?.isTextBased()) return;
            
            // Determine color based on pass rate
            const passRate = result.summary.passed / result.summary.total_checks;
            let color: number;
            
            if (passRate >= 0.9) {
                color = 0x00FF00; // Green (90%+ pass)
            } else if (passRate >= 0.75) {
                color = 0xFFFF00; // Yellow (75-90% pass)
            } else if (passRate >= 0.5) {
                color = 0xFFA500; // Orange (50-75% pass)
            } else {
                color = 0xFF0000; // Red (<50% pass)
            }
            
            // Create main summary embed
            const embed = new EmbedBuilder()
                .setTitle(`🛡️ Security Hardening Report (${result.profile})`)
                .setDescription(`${applyFixes ? 'Hardening' : 'Security check'} completed on ${result.system} (${result.os_type} ${result.os_version})`)
                .setColor(color)
                .setTimestamp(result.timestamp)
                .addFields(
                    { name: 'Profile', value: result.profile, inline: true },
                    { name: 'Duration', value: `${result.duration} seconds`, inline: true },
                    { name: 'Total Checks', value: result.summary.total_checks.toString(), inline: true },
                    { name: 'Passed', value: result.summary.passed.toString(), inline: true },
                    { name: 'Failed', value: result.summary.failed.toString(), inline: true },
                    { name: 'Warnings', value: result.summary.warnings.toString(), inline: true }
                );
            
            if (applyFixes) {
                embed.addFields(
                    { name: 'Fixes Applied', value: result.summary.fixes_applied.toString(), inline: true },
                    { name: 'Fixes Failed', value: result.summary.fixes_failed.toString(), inline: true }
                );
            }
            
            // Add compliance information
            const complianceText = `Overall compliance: ${(passRate * 100).toFixed(1)}%`;
            embed.addFields({ name: 'Compliance', value: complianceText });
            
            // Send main summary embed
            await (channel as TextChannel).send({ embeds: [embed] });
        } catch (error) {
            console.error('Error reporting hardening results to Discord:', error);
        }
    }

    /**
     * Get hardening recommendations for the system
     */
    public async getHardeningRecommendations(): Promise<string[]> {
        try {
            // Run a check without applying fixes
            const result = await this.runSecurityCheck('cis-level1');
            
            // Get the failed checks
            const failedChecks = result.checks.filter(c => c.status === 'fail');
            
            // Generate recommendations
            const recommendations = failedChecks.map(check => {
                let recommendation = `${check.id}: ${check.name}`;
                if (check.remediation) {
                    recommendation += ` - ${check.remediation}`;
                }
                return recommendation;
            });
            
            return recommendations;
        } catch (error) {
            console.error('Error getting hardening recommendations:', error);
            return ['Error getting recommendations: ' + (error instanceof Error ? error.message : String(error))];
        }
    }

    /**
     * Check if the system is compliant with a specific benchmark
     */
    public async checkCompliance(
        benchmark: 'cis-level1' | 'cis-level2' | 'nist' | 'pci-dss' = 'cis-level1'
    ): Promise<{ compliant: boolean; passRate: number; details: string }> {
        try {
            // Run a check without applying fixes
            const result = await this.runSecurityCheck(benchmark);
            
            // Calculate pass rate
            const passRate = result.summary.passed / result.summary.total_checks;
            
            // Determine if compliant (80% or higher pass rate is considered compliant)
            const compliant = passRate >= 0.8;
            
            // Generate details
            const details = `${result.summary.passed}/${result.summary.total_checks} checks passed (${(passRate * 100).toFixed(1)}%)`;
            
            return { compliant, passRate, details };
        } catch (error) {
            console.error('Error checking compliance:', error);
            return { 
                compliant: false, 
                passRate: 0, 
                details: 'Error checking compliance: ' + (error instanceof Error ? error.message : String(error)) 
            };
        }
    }
}

// Export singleton instance
let securityHardeningInstance: SecurityHardening | null = null;

export function getSecurityHardening(
    client: Client,
    notifyChannelId: string,
    logEvent: (type: string, description: string) => Promise<boolean>,
    resultsDir?: string
): SecurityHardening {
    if (!securityHardeningInstance) {
        securityHardeningInstance = new SecurityHardening(
            client,
            notifyChannelId,
            logEvent,
            resultsDir
        );
    }
    return securityHardeningInstance;
}
