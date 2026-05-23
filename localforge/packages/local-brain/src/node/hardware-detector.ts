import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MachineProfile, ModelModeId } from '../common/protocol';

const execAsync = promisify(exec);

export class HardwareDetector {
    public async detect(): Promise<MachineProfile> {
        const totalRamGB = os.totalmem() / (1024 ** 3);
        const freeRamGB = os.freemem() / (1024 ** 3);
        const osPlatform = os.platform();
        const arch = os.arch();

        let gpuDetected = 'Unknown / None detected';
        let gpuAccelerationPossible = false;
        let freeDiskSpaceGB: number | undefined;

        // Best effort GPU detection
        try {
            if (osPlatform === 'linux') {
                try {
                    const { stdout } = await execAsync('lspci | grep -i vga');
                    if (stdout.toLowerCase().includes('nvidia')) {
                        gpuDetected = 'NVIDIA GPU Detected';
                        gpuAccelerationPossible = true;
                    } else if (stdout.toLowerCase().includes('amd') || stdout.toLowerCase().includes('radeon')) {
                        gpuDetected = 'AMD GPU Detected';
                    } else if (stdout.toLowerCase().includes('intel')) {
                        gpuDetected = 'Intel Integrated Graphics';
                    } else {
                        gpuDetected = 'Generic/Unknown VGA';
                    }
                } catch (e) {
                    // Fallback to checking nvidia-smi
                    try {
                        await execAsync('nvidia-smi');
                        gpuDetected = 'NVIDIA GPU Detected (nvidia-smi)';
                        gpuAccelerationPossible = true;
                    } catch {
                        gpuDetected = 'Not detected (Linux fallback)';
                    }
                }

                // Best effort disk space for / or ~/.local
                try {
                    const { stdout } = await execAsync("df -k / | awk 'NR==2 {print $4}'");
                    const freeKB = parseInt(stdout.trim(), 10);
                    if (!isNaN(freeKB)) {
                        freeDiskSpaceGB = freeKB / (1024 ** 2);
                    }
                } catch {}

            } else if (osPlatform === 'darwin') {
                if (arch === 'arm64') {
                    gpuDetected = 'Apple Silicon (Metal)';
                    gpuAccelerationPossible = true;
                } else {
                    gpuDetected = 'Intel Mac (CPU fallback or AMD)';
                }
            } else if (osPlatform === 'win32') {
                try {
                    const { stdout } = await execAsync('wmic path win32_VideoController get name');
                    if (stdout.toLowerCase().includes('nvidia')) {
                        gpuDetected = 'NVIDIA GPU Detected';
                        gpuAccelerationPossible = true;
                    } else {
                        gpuDetected = 'GPU Detected (Windows wmic)';
                    }
                } catch {
                    gpuDetected = 'Not detected (Windows wmic failed)';
                }
            }
        } catch (e) {
            gpuDetected = `Detection Error: ${String(e)}`;
        }

        let recommendedMode: ModelModeId = 'fast';
        if (totalRamGB >= 60) {
            recommendedMode = 'powerful';
        } else if (totalRamGB >= 15) {
            recommendedMode = 'balanced';
        }

        return {
            os: osPlatform,
            arch,
            totalRamGB,
            freeRamGB,
            gpuDetected,
            gpuAccelerationPossible,
            freeDiskSpaceGB,
            recommendedMode
        };
    }
}
