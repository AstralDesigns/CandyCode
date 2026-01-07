"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GPUService = void 0;
/**
 * GPU Detection Service
 * Detects GPU capabilities for vLLM setup
 */
const child_process_1 = require("child_process");
const util_1 = require("util");
const electron_1 = require("electron");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GPUService {
    /**
     * Detect GPU with hybrid graphics support
     * Prefers dGPU over iGPU, returns primary GPU info
     */
    async detectGPU() {
        const result = await this.detectGPUsWithHybrid();
        return {
            vendor: result.primary.vendor,
            model: result.primary.model,
            cudaAvailable: result.primary.cudaAvailable || false,
            memoryGB: result.primary.memoryGB,
            isDiscrete: result.primary.isDiscrete,
        };
    }
    /**
     * Detect all GPUs and determine primary (prefer dGPU over iGPU)
     */
    async detectGPUsWithHybrid() {
        const gpus = [];
        const integratedGPUs = [];
        // Check NVIDIA (always discrete)
        const nvidiaInfo = await this.checkNVIDIAGPU();
        if (nvidiaInfo) {
            gpus.push({
                vendor: 'nvidia',
                isDiscrete: true,
                model: nvidiaInfo.model,
                cudaAvailable: nvidiaInfo.cudaAvailable,
                memoryGB: nvidiaInfo.memoryGB,
            });
        }
        // Check AMD via PCI/sysfs
        const amdInfo = await this.checkAMDGPU();
        if (amdInfo) {
            if (amdInfo.isDiscrete) {
                gpus.push({
                    vendor: 'amd',
                    isDiscrete: true,
                    model: amdInfo.model,
                });
            }
            else {
                integratedGPUs.push({
                    vendor: 'amd',
                    model: amdInfo.model,
                });
            }
        }
        // Check Intel (could be iGPU or dGPU)
        const intelInfo = await this.checkIntelGPU();
        if (intelInfo) {
            if (intelInfo.isDiscrete) {
                gpus.push({
                    vendor: 'intel',
                    isDiscrete: true,
                    model: intelInfo.model,
                });
            }
            else {
                integratedGPUs.push({
                    vendor: 'intel',
                    model: intelInfo.model,
                });
            }
        }
        // Fallback to Electron GPU info if nothing detected
        if (gpus.length === 0 && integratedGPUs.length === 0) {
            try {
                const gpuInfo = await electron_1.app.getGPUInfo('complete');
                const parsed = await this.parseElectronGPUInfo(gpuInfo);
                if (parsed.isDiscrete) {
                    gpus.push({
                        vendor: parsed.vendor,
                        isDiscrete: true,
                        model: parsed.model,
                        cudaAvailable: parsed.cudaAvailable,
                    });
                }
                else {
                    if (parsed.vendor === 'intel' || parsed.vendor === 'amd') {
                        integratedGPUs.push({
                            vendor: parsed.vendor,
                            model: parsed.model,
                        });
                    }
                }
            }
            catch (error) {
                console.error('[GPU] Error getting GPU info:', error);
            }
        }
        // Determine primary GPU: prefer dGPU over iGPU
        let primary;
        if (gpus.length > 0) {
            // Use first discrete GPU (prefer NVIDIA, then AMD, then Intel)
            const sorted = gpus.sort((a, b) => {
                const order = { nvidia: 0, amd: 1, intel: 2, unknown: 3 };
                return (order[a.vendor] || 3) - (order[b.vendor] || 3);
            });
            primary = sorted[0];
        }
        else if (integratedGPUs.length > 0) {
            // Fallback to integrated GPU
            const iGPU = integratedGPUs[0];
            primary = {
                vendor: iGPU.vendor,
                isDiscrete: false,
                model: iGPU.model,
            };
        }
        else {
            // No GPU detected
            primary = {
                vendor: 'unknown',
                isDiscrete: false,
                model: 'Unknown GPU',
            };
        }
        return {
            primary,
            integrated: integratedGPUs.length > 0 && primary.isDiscrete ? integratedGPUs[0] : undefined,
        };
    }
    async checkAMDGPU() {
        try {
            // Check for AMD GPU via PCI/sysfs
            const { stdout } = await execAsync('lspci | grep -i "vga\\|3d\\|display" | grep -i amd');
            if (stdout && stdout.trim()) {
                const lines = stdout.trim().split('\n');
                for (const line of lines) {
                    if (line.toLowerCase().includes('amd') || line.toLowerCase().includes('radeon')) {
                        // Try to get more info from sysfs
                        let model = 'AMD GPU';
                        try {
                            const { stdout: modelStdout } = await execAsync('lspci -s $(lspci | grep -i "vga\\|3d\\|display" | grep -i amd | cut -d" " -f1) -v | grep -i "subsystem"');
                            if (modelStdout) {
                                model = modelStdout.trim();
                            }
                        }
                        catch (e) {
                            // Ignore
                        }
                        // AMD GPUs are typically discrete (except APUs)
                        // Check if it's an APU by looking for integrated indicators
                        const isDiscrete = !line.toLowerCase().includes('apu') && !line.toLowerCase().includes('integrated');
                        return {
                            vendor: 'amd',
                            model,
                            isDiscrete,
                        };
                    }
                }
            }
        }
        catch (error) {
            // AMD GPU not found or lspci not available
        }
        return null;
    }
    async checkIntelGPU() {
        try {
            // Check for Intel GPU via PCI/sysfs
            const { stdout } = await execAsync('lspci | grep -i "vga\\|3d\\|display" | grep -i intel');
            if (stdout && stdout.trim()) {
                const lines = stdout.trim().split('\n');
                for (const line of lines) {
                    if (line.toLowerCase().includes('intel')) {
                        let model = 'Intel GPU';
                        try {
                            const { stdout: modelStdout } = await execAsync('lspci -s $(lspci | grep -i "vga\\|3d\\|display" | grep -i intel | cut -d" " -f1) -v | grep -i "subsystem"');
                            if (modelStdout) {
                                model = modelStdout.trim();
                            }
                        }
                        catch (e) {
                            // Ignore
                        }
                        // Intel Arc GPUs are discrete, integrated GPUs are not
                        const isDiscrete = line.toLowerCase().includes('arc') || line.toLowerCase().includes('discrete');
                        return {
                            vendor: 'intel',
                            model,
                            isDiscrete,
                        };
                    }
                }
            }
        }
        catch (error) {
            // Intel GPU not found or lspci not available
        }
        return null;
    }
    async checkNVIDIAGPU() {
        try {
            // Check if nvidia-smi is available
            const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total,compute_cap --format=csv,noheader,nounits');
            if (stdout && stdout.trim()) {
                const lines = stdout.trim().split('\n');
                const firstGPU = lines[0];
                const parts = firstGPU.split(',');
                const model = parts[0]?.trim() || 'NVIDIA GPU';
                const memoryMB = parseInt(parts[1]?.trim() || '0');
                const computeCap = parts[2]?.trim() || '';
                return {
                    vendor: 'nvidia',
                    model,
                    cudaAvailable: true,
                    memoryGB: memoryMB / 1024,
                    isDiscrete: true, // nvidia-smi typically shows discrete GPUs
                };
            }
        }
        catch (error) {
            // nvidia-smi not available or no NVIDIA GPU
            return null;
        }
        return null;
    }
    async checkCUDA() {
        try {
            await execAsync('nvidia-smi');
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async parseElectronGPUInfo(gpuInfo) {
        const auxAttributes = gpuInfo.auxAttributes || {};
        const vendorId = auxAttributes.vendorId || '';
        const deviceId = auxAttributes.deviceId || '';
        // Determine vendor from vendor ID
        let vendor = 'unknown';
        if (vendorId) {
            const vendorIdNum = parseInt(vendorId, 16);
            // NVIDIA: 0x10DE, AMD: 0x1002, Intel: 0x8086
            if (vendorIdNum === 0x10de)
                vendor = 'nvidia';
            else if (vendorIdNum === 0x1002)
                vendor = 'amd';
            else if (vendorIdNum === 0x8086)
                vendor = 'intel';
        }
        const model = auxAttributes.deviceString || gpuInfo.vendors?.[0]?.vendor || 'Unknown GPU';
        const isDiscrete = vendor === 'nvidia' || vendor === 'amd';
        const cudaAvailable = vendor === 'nvidia' ? await this.checkCUDA() : false;
        return {
            vendor,
            model,
            cudaAvailable,
            isDiscrete,
        };
    }
    async getGPUInfo() {
        return this.detectGPU();
    }
    /**
     * Get detailed GPU detection result with hybrid graphics info
     */
    async getGPUInfoWithHybrid() {
        return this.detectGPUsWithHybrid();
    }
}
exports.GPUService = GPUService;
//# sourceMappingURL=gpu.service.js.map