"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerraformManager = void 0;
exports.getTerraformManager = getTerraformManager;
const discord_js_1 = require("discord.js");
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const execAsync = util_1.default.promisify(child_process_1.exec);
/**
 * Class for Terraform infrastructure management
 */
class TerraformManager {
    constructor(client, notifyChannelId, logEvent, workingDir, terraformPath) {
        this.isRunningOperation = false;
        this.terraformVersion = 'unknown';
        this.defaultVarsFile = '';
        this.client = client;
        this.notifyChannelId = notifyChannelId;
        this.logEvent = logEvent;
        this.workingDir = workingDir || path_1.default.join(process.cwd(), 'terraform');
        this.terraformPath = terraformPath || 'terraform';
        // Create working directory if it doesn't exist
        if (!fs_1.default.existsSync(this.workingDir)) {
            fs_1.default.mkdirSync(this.workingDir, { recursive: true });
        }
    }
    /**
     * Initialize the Terraform manager
     */
    async initialize() {
        try {
            console.log('Initializing Terraform manager...');
            // Check if Terraform is installed
            try {
                const { stdout } = await execAsync(`${this.terraformPath} version`);
                // Extract version number
                const versionMatch = stdout.match(/Terraform v([0-9.]+)/);
                if (versionMatch && versionMatch[1]) {
                    this.terraformVersion = versionMatch[1];
                    console.log(`Terraform detected: v${this.terraformVersion}`);
                }
                else {
                    console.log('Terraform detected but version could not be determined');
                }
            }
            catch (error) {
                console.warn('Terraform not found in PATH. Infrastructure provisioning functionality will be limited.');
                await this.logEvent('INFRASTRUCTURE', 'Terraform not detected. Some features will be unavailable.');
                return false;
            }
            // Check if working directory contains Terraform files
            const tfFiles = await this.findTerraformFiles();
            if (tfFiles.length === 0) {
                console.log(`No Terraform files found in ${this.workingDir}. Creating example files...`);
                await this.createExampleTerraformFiles();
            }
            else {
                console.log(`Found ${tfFiles.length} Terraform files in ${this.workingDir}`);
            }
            // Check for tfvars files
            const tfVarsFiles = await this.findTerraformVarsFiles();
            if (tfVarsFiles.length > 0) {
                this.defaultVarsFile = tfVarsFiles[0];
                console.log(`Using ${this.defaultVarsFile} as default variables file`);
            }
            // Initialize Terraform if .terraform directory doesn't exist
            if (!fs_1.default.existsSync(path_1.default.join(this.workingDir, '.terraform'))) {
                console.log('Initializing Terraform...');
                await this.runTerraformCommand('init');
            }
            await this.logEvent('INFRASTRUCTURE', `Terraform manager initialized with Terraform v${this.terraformVersion}`);
            return true;
        }
        catch (error) {
            console.error('Error initializing Terraform manager:', error);
            await this.logEvent('ERROR', `Failed to initialize Terraform manager: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    /**
     * Find Terraform files in the working directory
     */
    async findTerraformFiles() {
        try {
            const files = await fs_1.default.promises.readdir(this.workingDir);
            return files.filter(file => file.endsWith('.tf'));
        }
        catch (error) {
            console.error('Error finding Terraform files:', error);
            return [];
        }
    }
    /**
     * Find Terraform variables files in the working directory
     */
    async findTerraformVarsFiles() {
        try {
            const files = await fs_1.default.promises.readdir(this.workingDir);
            return files.filter(file => file.endsWith('.tfvars') || file.endsWith('.tfvars.json'));
        }
        catch (error) {
            console.error('Error finding Terraform variables files:', error);
            return [];
        }
    }
    /**
     * Create example Terraform files in the working directory
     */
    async createExampleTerraformFiles() {
        try {
            // Create main.tf with a simple example
            const mainTfContent = `
            # Example Terraform configuration

            terraform {
              required_providers {
                local = {
                  source = "hashicorp/local"
                  version = "~> 2.1.0"
                }
              }
            }

            provider "local" {
            }

            resource "local_file" "example" {
              content  = "This file was created by Terraform via Noxhime!"
              filename = "\${path.module}/example.txt"
            }

            output "file_path" {
              value = local_file.example.filename
            }
            `;
            // Create variables.tf
            const variablesTfContent = `
            # Example variables

            variable "file_content" {
              description = "Content to write to the file"
              type        = string
              default     = "This file was created by Terraform via Noxhime!"
            }

            variable "file_name" {
              description = "Name of the file to create"
              type        = string
              default     = "example.txt"
            }
            `;
            // Create terraform.tfvars
            const tfvarsContent = `
            # Example variable values
            file_content = "This is a custom message from Terraform via Noxhime!"
            file_name    = "example.txt"
            `;
            // Write files
            await fs_1.default.promises.writeFile(path_1.default.join(this.workingDir, 'main.tf'), mainTfContent.trim());
            await fs_1.default.promises.writeFile(path_1.default.join(this.workingDir, 'variables.tf'), variablesTfContent.trim());
            await fs_1.default.promises.writeFile(path_1.default.join(this.workingDir, 'terraform.tfvars'), tfvarsContent.trim());
            console.log('Created example Terraform files in the working directory');
        }
        catch (error) {
            console.error('Error creating example Terraform files:', error);
        }
    }
    /**
     * Run a Terraform command
     */
    async runTerraformCommand(command, args = [], options = {}) {
        const fullCommand = `cd "${this.workingDir}" && ${this.terraformPath} ${command} ${args.join(' ')}`;
        console.log(`Running Terraform command: ${fullCommand}`);
        try {
            const { stdout, stderr } = await execAsync(fullCommand, {
                timeout: options.timeout || 600000, // Default timeout: 10 minutes
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });
            return { stdout, stderr, exitCode: 0 };
        }
        catch (error) {
            if (error.stdout || error.stderr) {
                return {
                    stdout: error.stdout || '',
                    stderr: error.stderr || '',
                    exitCode: error.code || 1
                };
            }
            throw error;
        }
    }
    /**
     * Run Terraform plan
     */
    async plan(varsFile) {
        if (this.isRunningOperation) {
            throw new Error('A Terraform operation is already in progress');
        }
        this.isRunningOperation = true;
        try {
            console.log('Running Terraform plan...');
            await this.logEvent('INFRASTRUCTURE', 'Running Terraform plan');
            // Build arguments
            const args = ['-detailed-exitcode', '-out=tfplan'];
            if (varsFile || this.defaultVarsFile) {
                args.push(`-var-file=${varsFile || this.defaultVarsFile}`);
            }
            // Run plan command
            const { stdout, stderr, exitCode } = await this.runTerraformCommand('plan', args);
            // Parse plan output
            let add = 0;
            let change = 0;
            let destroy = 0;
            // Look for the plan summary line
            const planSummaryMatch = stdout.match(/Plan: (\d+) to add, (\d+) to change, (\d+) to destroy/);
            if (planSummaryMatch) {
                add = parseInt(planSummaryMatch[1]);
                change = parseInt(planSummaryMatch[2]);
                destroy = parseInt(planSummaryMatch[3]);
            }
            // Report result
            await this.reportPlanResult({
                add,
                change,
                destroy,
                raw_output: stdout
            });
            await this.logEvent('INFRASTRUCTURE', `Terraform plan completed: ${add} to add, ${change} to change, ${destroy} to destroy`);
            return {
                add,
                change,
                destroy,
                raw_output: stdout
            };
        }
        catch (error) {
            console.error('Error running Terraform plan:', error);
            await this.logEvent('ERROR', `Terraform plan failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
        finally {
            this.isRunningOperation = false;
        }
    }
    /**
     * Run Terraform apply
     */
    async apply(autoApprove = false, varsFile) {
        if (this.isRunningOperation) {
            throw new Error('A Terraform operation is already in progress');
        }
        this.isRunningOperation = true;
        try {
            console.log('Running Terraform apply...');
            await this.logEvent('INFRASTRUCTURE', `Running Terraform apply${autoApprove ? ' with auto-approve' : ''}`);
            const startTime = Date.now();
            // Build arguments
            const args = [];
            if (autoApprove) {
                args.push('-auto-approve');
            }
            if (varsFile || this.defaultVarsFile) {
                args.push(`-var-file=${varsFile || this.defaultVarsFile}`);
            }
            // If we have a plan file, use it
            if (fs_1.default.existsSync(path_1.default.join(this.workingDir, 'tfplan'))) {
                args.push('tfplan');
            }
            // Run apply command
            const { stdout, stderr, exitCode } = await this.runTerraformCommand('apply', args);
            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);
            // Parse apply output
            let added = 0;
            let changed = 0;
            let destroyed = 0;
            let success = exitCode === 0;
            // Look for the apply summary line
            const applySummaryMatch = stdout.match(/Apply complete! Resources: (\d+) added, (\d+) changed, (\d+) destroyed/);
            if (applySummaryMatch) {
                added = parseInt(applySummaryMatch[1]);
                changed = parseInt(applySummaryMatch[2]);
                destroyed = parseInt(applySummaryMatch[3]);
                success = true;
            }
            const result = {
                added,
                changed,
                destroyed,
                duration,
                success,
                raw_output: stdout,
                error: !success ? stderr : undefined
            };
            // Report result
            await this.reportApplyResult(result);
            await this.logEvent('INFRASTRUCTURE', `Terraform apply completed in ${duration}s: ${added} added, ${changed} changed, ${destroyed} destroyed, success: ${success}`);
            return result;
        }
        catch (error) {
            console.error('Error running Terraform apply:', error);
            await this.logEvent('ERROR', `Terraform apply failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
        finally {
            this.isRunningOperation = false;
        }
    }
    /**
     * Run Terraform destroy
     */
    async destroy(autoApprove = false, varsFile) {
        if (this.isRunningOperation) {
            throw new Error('A Terraform operation is already in progress');
        }
        this.isRunningOperation = true;
        try {
            console.log('Running Terraform destroy...');
            await this.logEvent('INFRASTRUCTURE', `Running Terraform destroy${autoApprove ? ' with auto-approve' : ''}`);
            const startTime = Date.now();
            // Build arguments
            const args = [];
            if (autoApprove) {
                args.push('-auto-approve');
            }
            if (varsFile || this.defaultVarsFile) {
                args.push(`-var-file=${varsFile || this.defaultVarsFile}`);
            }
            // Run destroy command
            const { stdout, stderr, exitCode } = await this.runTerraformCommand('destroy', args);
            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);
            // Parse destroy output
            let destroyed = 0;
            let success = exitCode === 0;
            // Look for the destroy summary line
            const destroySummaryMatch = stdout.match(/Destroy complete! Resources: (\d+) destroyed/);
            if (destroySummaryMatch) {
                destroyed = parseInt(destroySummaryMatch[1]);
                success = true;
            }
            const result = {
                added: 0,
                changed: 0,
                destroyed,
                duration,
                success,
                raw_output: stdout,
                error: !success ? stderr : undefined
            };
            // Report result
            await this.reportDestroyResult(result);
            await this.logEvent('INFRASTRUCTURE', `Terraform destroy completed in ${duration}s: ${destroyed} destroyed, success: ${success}`);
            return result;
        }
        catch (error) {
            console.error('Error running Terraform destroy:', error);
            await this.logEvent('ERROR', `Terraform destroy failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
        finally {
            this.isRunningOperation = false;
        }
    }
    /**
     * Report Terraform plan result to Discord
     */
    async reportPlanResult(result) {
        try {
            if (!this.client.isReady() || !this.notifyChannelId)
                return;
            const channel = await this.client.channels.fetch(this.notifyChannelId);
            if (!channel?.isTextBased())
                return;
            // Determine color based on changes
            let color;
            if (result.add === 0 && result.change === 0 && result.destroy === 0) {
                color = 0x00FF00; // Green - no changes
            }
            else if (result.destroy > 0) {
                color = 0xFF0000; // Red - resources will be destroyed
            }
            else if (result.change > 0) {
                color = 0xFFA500; // Orange - resources will be changed
            }
            else {
                color = 0x3498DB; // Blue - only additions
            }
            // Create embed
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🔍 Terraform Plan Result')
                .setDescription('Infrastructure changes that would be applied')
                .setColor(color)
                .setTimestamp()
                .addFields({ name: 'To Add', value: result.add.toString(), inline: true }, { name: 'To Change', value: result.change.toString(), inline: true }, { name: 'To Destroy', value: result.destroy.toString(), inline: true });
            // Add summary of changes
            if (result.add === 0 && result.change === 0 && result.destroy === 0) {
                embed.addFields({ name: 'Summary', value: 'No changes required. Infrastructure is up-to-date.' });
            }
            else {
                embed.addFields({
                    name: 'Summary',
                    value: `Plan: ${result.add} to add, ${result.change} to change, ${result.destroy} to destroy.`
                });
                // Add a snippet of the raw output (limited to avoid Discord's limit)
                const outputSnippet = result.raw_output.substring(0, 1000) +
                    (result.raw_output.length > 1000 ? '...' : '');
                embed.addFields({ name: 'Plan Details', value: `\`\`\`\n${outputSnippet}\n\`\`\`` });
            }
            // Send embed
            await channel.send({ embeds: [embed] });
        }
        catch (error) {
            console.error('Error reporting Terraform plan result:', error);
        }
    }
    /**
     * Report Terraform apply result to Discord
     */
    async reportApplyResult(result) {
        try {
            if (!this.client.isReady() || !this.notifyChannelId)
                return;
            const channel = await this.client.channels.fetch(this.notifyChannelId);
            if (!channel?.isTextBased())
                return;
            // Determine color based on success and changes
            let color;
            if (!result.success) {
                color = 0xFF0000; // Red - apply failed
            }
            else if (result.added === 0 && result.changed === 0 && result.destroyed === 0) {
                color = 0x00FF00; // Green - no changes applied
            }
            else if (result.destroyed > 0) {
                color = 0xFFA500; // Orange - resources were destroyed
            }
            else {
                color = 0x3498DB; // Blue - resources were added/changed
            }
            // Create embed
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`${result.success ? '✅' : '❌'} Terraform Apply Result`)
                .setDescription(`Infrastructure ${result.success ? 'changes applied' : 'apply failed'}`)
                .setColor(color)
                .setTimestamp()
                .addFields({ name: 'Status', value: result.success ? 'Success' : 'Failed', inline: true }, { name: 'Duration', value: `${result.duration} seconds`, inline: true });
            if (result.success) {
                embed.addFields({ name: 'Added', value: result.added.toString(), inline: true }, { name: 'Changed', value: result.changed.toString(), inline: true }, { name: 'Destroyed', value: result.destroyed.toString(), inline: true }, { name: 'Summary', value: `Apply complete! Resources: ${result.added} added, ${result.changed} changed, ${result.destroyed} destroyed.` });
            }
            else {
                // Add error information
                embed.addFields({
                    name: 'Error',
                    value: result.error || 'Unknown error occurred during apply'
                });
            }
            // Add a snippet of the raw output (limited to avoid Discord's limit)
            const outputSnippet = result.raw_output.substring(0, 1000) +
                (result.raw_output.length > 1000 ? '...' : '');
            embed.addFields({ name: 'Output', value: `\`\`\`\n${outputSnippet}\n\`\`\`` });
            // Send embed
            await channel.send({ embeds: [embed] });
        }
        catch (error) {
            console.error('Error reporting Terraform apply result:', error);
        }
    }
    /**
     * Report Terraform destroy result to Discord
     */
    async reportDestroyResult(result) {
        try {
            if (!this.client.isReady() || !this.notifyChannelId)
                return;
            const channel = await this.client.channels.fetch(this.notifyChannelId);
            if (!channel?.isTextBased())
                return;
            // Determine color based on success
            let color;
            if (!result.success) {
                color = 0xFF0000; // Red - destroy failed
            }
            else if (result.destroyed === 0) {
                color = 0x00FF00; // Green - no resources destroyed
            }
            else {
                color = 0xFFA500; // Orange - resources were destroyed
            }
            // Create embed
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`${result.success ? '✅' : '❌'} Terraform Destroy Result`)
                .setDescription(`Infrastructure ${result.success ? 'destruction completed' : 'destroy failed'}`)
                .setColor(color)
                .setTimestamp()
                .addFields({ name: 'Status', value: result.success ? 'Success' : 'Failed', inline: true }, { name: 'Duration', value: `${result.duration} seconds`, inline: true });
            if (result.success) {
                embed.addFields({ name: 'Destroyed', value: result.destroyed.toString(), inline: true }, { name: 'Summary', value: `Destroy complete! Resources: ${result.destroyed} destroyed.` });
            }
            else {
                // Add error information
                embed.addFields({
                    name: 'Error',
                    value: result.error || 'Unknown error occurred during destroy'
                });
            }
            // Add a snippet of the raw output (limited to avoid Discord's limit)
            const outputSnippet = result.raw_output.substring(0, 1000) +
                (result.raw_output.length > 1000 ? '...' : '');
            embed.addFields({ name: 'Output', value: `\`\`\`\n${outputSnippet}\n\`\`\`` });
            // Send embed
            await channel.send({ embeds: [embed] });
        }
        catch (error) {
            console.error('Error reporting Terraform destroy result:', error);
        }
    }
    /**
     * List Terraform workspaces
     */
    async listWorkspaces() {
        try {
            console.log('Listing Terraform workspaces...');
            const { stdout } = await this.runTerraformCommand('workspace', ['list']);
            const workspaces = [];
            const lines = stdout.split('\n').filter(Boolean);
            // Parse workspace output
            for (const line of lines) {
                const isCurrentWorkspace = line.startsWith('*');
                const name = line.replace(/^\*?\s*/, '').trim();
                if (name) {
                    workspaces.push({
                        name,
                        current: isCurrentWorkspace
                    });
                }
            }
            return workspaces;
        }
        catch (error) {
            console.error('Error listing Terraform workspaces:', error);
            return [];
        }
    }
    /**
     * Select a Terraform workspace
     */
    async selectWorkspace(workspace) {
        try {
            console.log(`Selecting Terraform workspace: ${workspace}...`);
            await this.logEvent('INFRASTRUCTURE', `Selecting Terraform workspace: ${workspace}`);
            const { exitCode, stderr } = await this.runTerraformCommand('workspace', ['select', workspace]);
            if (exitCode !== 0) {
                throw new Error(`Failed to select workspace: ${stderr}`);
            }
            return true;
        }
        catch (error) {
            console.error(`Error selecting workspace ${workspace}:`, error);
            await this.logEvent('ERROR', `Failed to select Terraform workspace: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    /**
     * Create a new Terraform workspace
     */
    async createWorkspace(workspace) {
        try {
            console.log(`Creating Terraform workspace: ${workspace}...`);
            await this.logEvent('INFRASTRUCTURE', `Creating Terraform workspace: ${workspace}`);
            const { exitCode, stderr } = await this.runTerraformCommand('workspace', ['new', workspace]);
            if (exitCode !== 0) {
                throw new Error(`Failed to create workspace: ${stderr}`);
            }
            return true;
        }
        catch (error) {
            console.error(`Error creating workspace ${workspace}:`, error);
            await this.logEvent('ERROR', `Failed to create Terraform workspace: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    /**
     * Get Terraform output values
     */
    async getOutputs() {
        try {
            console.log('Getting Terraform outputs...');
            const { stdout, exitCode } = await this.runTerraformCommand('output', ['-json']);
            if (exitCode !== 0 || !stdout) {
                return {};
            }
            // Parse JSON output
            const outputs = JSON.parse(stdout);
            // Extract values from complex output structure
            const simplifiedOutputs = {};
            for (const [key, details] of Object.entries(outputs)) {
                if (typeof details === 'object' && details && 'value' in details) {
                    simplifiedOutputs[key] = details.value;
                }
                else {
                    simplifiedOutputs[key] = details;
                }
            }
            return simplifiedOutputs;
        }
        catch (error) {
            console.error('Error getting Terraform outputs:', error);
            return {};
        }
    }
    /**
     * List Terraform resources
     */
    async listResources() {
        try {
            console.log('Listing Terraform resources...');
            // Try the show command first
            try {
                const { stdout, exitCode } = await this.runTerraformCommand('show', ['-json']);
                if (exitCode === 0 && stdout) {
                    const stateData = JSON.parse(stdout);
                    const resources = [];
                    // Extract resources from state data
                    if (stateData.values && stateData.values.root_module && stateData.values.root_module.resources) {
                        for (const resource of stateData.values.root_module.resources) {
                            resources.push({
                                name: resource.name,
                                type: resource.type,
                                provider: resource.provider_name || 'unknown',
                                values: resource.values
                            });
                        }
                    }
                    return resources;
                }
            }
            catch (error) {
                console.log('Failed to get resources using show command, falling back to state list');
            }
            // Fall back to state list
            const { stdout } = await this.runTerraformCommand('state', ['list']);
            const resources = [];
            const lines = stdout.split('\n').filter(Boolean);
            // Parse resource lines
            for (const line of lines) {
                const parts = line.split('.');
                if (parts.length >= 2) {
                    const type = parts[0];
                    const name = parts.slice(1).join('.');
                    resources.push({
                        name,
                        type,
                        provider: type.split('_')[0] || 'unknown'
                    });
                }
            }
            return resources;
        }
        catch (error) {
            console.error('Error listing Terraform resources:', error);
            return [];
        }
    }
    /**
     * Get Terraform state for a specific resource
     */
    async getResourceState(resourceAddress) {
        try {
            console.log(`Getting Terraform state for resource: ${resourceAddress}...`);
            const { stdout, exitCode } = await this.runTerraformCommand('state', ['show', '-json', resourceAddress]);
            if (exitCode !== 0 || !stdout) {
                return null;
            }
            // Parse JSON output
            return JSON.parse(stdout);
        }
        catch (error) {
            console.error(`Error getting state for resource ${resourceAddress}:`, error);
            return null;
        }
    }
    /**
     * Get available Terraform templates from the templates directory
     */
    async getAvailableTemplates() {
        try {
            const templatesDir = path_1.default.join(process.cwd(), 'config', 'terraform-templates');
            if (!fs_1.default.existsSync(templatesDir)) {
                fs_1.default.mkdirSync(templatesDir, { recursive: true });
                // Create a simple template as an example
                const exampleDir = path_1.default.join(templatesDir, 'example');
                fs_1.default.mkdirSync(exampleDir, { recursive: true });
                // Create main.tf in the example template
                const mainTfContent = `
                # Example Terraform template

                terraform {
                  required_providers {
                    local = {
                      source = "hashicorp/local"
                      version = "~> 2.1.0"
                    }
                  }
                }

                provider "local" {
                }

                resource "local_file" "example" {
                  content  = var.file_content
                  filename = "${process.cwd()}/\${var.file_name}"
                }

                output "file_path" {
                  value = local_file.example.filename
                }
                `;
                // Create variables.tf in the example template
                const variablesTfContent = `
                # Example variables

                variable "file_content" {
                  description = "Content to write to the file"
                  type        = string
                  default     = "This file was created from a template by Terraform via Noxhime!"
                }

                variable "file_name" {
                  description = "Name of the file to create"
                  type        = string
                  default     = "example-from-template.txt"
                }
                `;
                // Write the files
                await fs_1.default.promises.writeFile(path_1.default.join(exampleDir, 'main.tf'), mainTfContent.trim());
                await fs_1.default.promises.writeFile(path_1.default.join(exampleDir, 'variables.tf'), variablesTfContent.trim());
                console.log('Created example Terraform template');
            }
            // List directories in the templates directory
            const items = await fs_1.default.promises.readdir(templatesDir, { withFileTypes: true });
            const templates = items
                .filter(item => item.isDirectory())
                .map(item => item.name);
            return templates;
        }
        catch (error) {
            console.error('Error getting available Terraform templates:', error);
            return [];
        }
    }
    /**
     * Use a template to initialize the working directory
     */
    async useTemplate(templateName) {
        try {
            console.log(`Using Terraform template: ${templateName}...`);
            await this.logEvent('INFRASTRUCTURE', `Using Terraform template: ${templateName}`);
            const templatesDir = path_1.default.join(process.cwd(), 'config', 'terraform-templates');
            const templateDir = path_1.default.join(templatesDir, templateName);
            if (!fs_1.default.existsSync(templateDir)) {
                throw new Error(`Template "${templateName}" not found`);
            }
            // Clear existing Terraform files in working directory
            const tfFiles = await this.findTerraformFiles();
            for (const file of tfFiles) {
                await fs_1.default.promises.unlink(path_1.default.join(this.workingDir, file));
            }
            // Copy template files to working directory
            const templateFiles = await fs_1.default.promises.readdir(templateDir);
            for (const file of templateFiles) {
                const sourcePath = path_1.default.join(templateDir, file);
                const destPath = path_1.default.join(this.workingDir, file);
                const fileContent = await fs_1.default.promises.readFile(sourcePath, 'utf8');
                await fs_1.default.promises.writeFile(destPath, fileContent);
            }
            // Re-initialize Terraform
            await this.runTerraformCommand('init', ['-reconfigure']);
            await this.logEvent('INFRASTRUCTURE', `Successfully initialized with template: ${templateName}`);
            return true;
        }
        catch (error) {
            console.error(`Error using template ${templateName}:`, error);
            await this.logEvent('ERROR', `Failed to use Terraform template: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
}
exports.TerraformManager = TerraformManager;
// Export singleton instance
let terraformManagerInstance = null;
function getTerraformManager(client, notifyChannelId, logEvent, workingDir, terraformPath) {
    if (!terraformManagerInstance) {
        terraformManagerInstance = new TerraformManager(client, notifyChannelId, logEvent, workingDir, terraformPath);
    }
    return terraformManagerInstance;
}
