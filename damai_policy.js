(function() {
    'use strict';

    // 调试通知
    $notification.post("策略检测", "damai_policy.js 已加载", "");

    // 常见的策略名称列表
    const POLICY_CANDIDATES = [
        'Proxy',
        'selectProxy',
        'GlobalProxy',
        'AutoSelect',
        'DIRECT'
    ];

    // 测试 URL（用于检测策略是否可用）
    const TEST_URL = 'https://raw.githubusercontent.com/bobboobibob/Damai/main/scripts/damai_ui.js';

    // 检测可用策略
    async function detectPolicy() {
        for (let policy of POLICY_CANDIDATES) {
            try {
                // 使用 $httpClient 测试请求
                const response = await new Promise((resolve, reject) => {
                    $httpClient.get({
                        url: TEST_URL,
                        policy: policy,
                        headers: {
                            'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)'
                        }
                    }, (error, response, data) => {
                        if (error || response.status !== 200) {
                            reject(error || '请求失败');
                        } else {
                            resolve(response);
                        }
                    });
                });

                // 如果请求成功，说明策略可用
                $notification.post("策略检测成功", `找到可用策略: ${policy}`, "");
                return policy;
            } catch (e) {
                $notification.post("策略检测失败", `测试策略 ${policy} 失败: ${e}`, "");
            }
        }

        // 如果没有找到可用策略，默认使用 DIRECT
        $notification.post("策略检测失败", "未找到可用策略，使用 DIRECT", "");
        return 'DIRECT';
    }

    // 主逻辑
    async function main() {
        const policy = await detectPolicy();
        // 保存可用策略到持久化存储
        $persistentStore.write(policy, "damai_policy");
        $notification.post("策略设置", `已设置策略: ${policy}`, "");
        $done();
    }

    main();
})();
