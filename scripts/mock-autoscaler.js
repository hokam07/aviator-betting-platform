const { execSync } = require('child_process');

const CONFIG = {
    services: ['gateway', 'ledger-worker'],
    threshold: 70, // CPU percentage
    min: 1,
    max: 10,
    interval: 5000, // 5 seconds
    cooldown: 30000 // 30 seconds
};

let currentScale = {
    gateway: 1,
    'ledger-worker': 1
};

let lastScaleTime = 0;

function getStats() {
    try {
        const output = execSync('docker stats --no-stream --format "{{.Name}}: {{.CPUPerc}}"').toString();
        const lines = output.trim().split('\n');
        const stats = {};

        lines.forEach(line => {
            const [name, cpu] = line.split(': ');
            if (cpu) {
                stats[name] = parseFloat(cpu.replace('%', ''));
            }
        });
        return stats;
    } catch (err) {
        console.error('Failed to get docker stats:', err.message);
        return null;
    }
}

function calculateAverageCpu(stats, serviceName) {
    let totalCpu = 0;
    let count = 0;

    Object.keys(stats).forEach(containerName => {
        if (containerName.includes(serviceName)) {
            totalCpu += stats[containerName];
            count++;
        }
    });

    return count > 0 ? totalCpu / count : 0;
}

function scale(service, target) {
    if (target < CONFIG.min || target > CONFIG.max) return;
    if (target === currentScale[service]) return;

    if (Date.now() - lastScaleTime < CONFIG.cooldown) {
        console.log(`[AUTOSCALER] Cooldown active. Skipping scale for ${service}...`);
        return;
    }

    console.log(`[AUTOSCALER] 🚀 Scaling ${service} from ${currentScale[service]} to ${target}...`);
    try {
        currentScale[service] = target;
        const scaleCmd = CONFIG.services.map(s => `--scale ${s}=${currentScale[s]}`).join(' ');
        execSync(`docker-compose -f ../docker-compose.yml up -d ${scaleCmd}`);
        lastScaleTime = Date.now();
        console.log(`[AUTOSCALER] ✅ Scaled successfully.`);
    } catch (err) {
        console.error(`[AUTOSCALER] ❌ Scale failed:`, err.message);
    }
}

async function loop() {
    console.log(`[AUTOSCALER] Monitoring services: ${CONFIG.services.join(', ')}`);
    console.log(`[AUTOSCALER] Threshold: ${CONFIG.threshold}%, Interval: ${CONFIG.interval}ms, Cooldown: ${CONFIG.cooldown}ms`);

    while (true) {
        const stats = getStats();
        if (stats) {
            CONFIG.services.forEach(service => {
                const avgCpu = calculateAverageCpu(stats, service);
                process.stdout.write(`\r[STATS] ${service}: ${avgCpu.toFixed(1)}% (${currentScale[service]} instances) | `);

                if (avgCpu > CONFIG.threshold && currentScale[service] < CONFIG.max) {
                    console.log(`\n[AUTOSCALER] High load detected on ${service} (${avgCpu.toFixed(1)}%)`);
                    scale(service, currentScale[service] + 1);
                } else if (avgCpu < 10 && currentScale[service] > CONFIG.min) {
                    // Very light load, scale down
                    console.log(`\n[AUTOSCALER] Low load detected on ${service} (${avgCpu.toFixed(1)}%)`);
                    scale(service, currentScale[service] - 1);
                }
            });
        }
        await new Promise(resolve => setTimeout(resolve, CONFIG.interval));
    }
}

loop().catch(console.error);
