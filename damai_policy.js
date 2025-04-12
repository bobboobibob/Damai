(function() {
    'use strict';

    $notification.post("策略检测", "damai_policy.js 已加载", "");

    const POLICY_CANDIDATES = [
        'Hong Kong',
        'Japan',
        'United States',
        'Singapore',
        'South Korea',
        'Taiwan',
        'Macao',
        'DIRECT'
    ];

    const TEST_URL = 'https://raw.githubusercontent.com/bobboobibob/Damai/main/scripts/damai_ui.js';

    async function detectPolicy() {
        for (let policy of POLICY_CANDIDATES) {
            try {
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

                $notification.post("策略检测成功", `找到可用策略: ${policy}`, "");
                return policy;
            } catch (e) {
                $notification.post("策略检测失败", `测试策略 ${policy} 失败: ${e}`, "");
            }
        }

        $notification.post("策略检测失败", "未找到可用策略，使用 DIRECT", "");
        return 'DIRECT';
    }

    async function main() {
        const policy = await detectPolicy();
        $persistentStore.write(policy, "damai_policy");
        $notification.post("策略设置", `已设置策略: ${policy}`, "");
        $done();
    }

    main();
})();
