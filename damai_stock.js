(function() {
    'use strict';

    // 调试通知
    $notification.post("余票监控", "damai_stock.js 已加载", "");

    // 配置项
    const CONFIG = {
        MAX_RETRIES: 3,
        CHECK_INTERVAL: 1000
    };

    // 候选余票 API 列表（根据抓包记录推测）
    const STOCK_API_CANDIDATES = [
        'https://api.damai.cn/ticket/inventory.query',
        'https://api.damai.cn/ticket/stock.query',
        'https://api.damai.cn/inventory/get',
        'https://mtop.damai.cn/h5/mtop.damai.ticket.inventory.query/1.0/'
    ];

    // 读取 sessionId 和 priceId
    const sessionId = $persistentStore.read("damai_session_id");
    const priceId = $persistentStore.read("damai_price_id");

    // 自动检测余票 API
    async function detectStockApi(sessionId, priceId) {
        let stockApi = $persistentStore.read("damai_stock_api");
        if (stockApi) {
            return stockApi; // 如果已保存，直接返回
        }

        $notification.post("API 检测", "开始检测余票 API", "");
        for (let api of STOCK_API_CANDIDATES) {
            try {
                const testUrl = `${api}?sessionId=${sessionId}&priceId=${priceId}`;
                const response = await new Promise((resolve, reject) => {
                    $httpClient.get({
                        url: testUrl,
                        headers: {
                            'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                            'Content-Type': 'application/json',
                            'Cookie': $persistentStore.read("damai_cookie") || ''
                        }
                    }, (error, response, data) => {
                        if (error || response.status !== 200) {
                            reject(error || '请求失败');
                        } else {
                            resolve({ response, data });
                        }
                    });
                });

                const json = JSON.parse(response.data);
                // 假设余票 API 响应中包含 "stock" 或 "inventory" 字段
                if (json.data && (json.data.stock !== undefined || json.data.inventory !== undefined)) {
                    $persistentStore.write(api, "damai_stock_api");
                    $notification.post("API 检测成功", `余票 API: ${api}`, "");
                    return api;
                }
            } catch (e) {
                $notification.post("API 检测失败", `测试 ${api} 失败: ${e}`, "");
            }
        }

        throw new Error("未找到有效的余票 API，请手动抓包确认");
    }

    // 监测余票
    async function checkStock(sessionId, priceId, stockApi) {
        const stockUrl = `${stockApi}?sessionId=${sessionId}&priceId=${priceId}`;
        return new Promise((resolve, reject) => {
            $httpClient.get({
                url: stockUrl,
                headers: {
                    'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                    'Content-Type': 'application/json',
                    'Cookie': $persistentStore.read("damai_cookie") || ''
                }
            }, (error, response, data) => {
                if (error || response.status !== 200) {
                    reject('获取余票失败：' + (error || '未知错误'));
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    const stock = json.data?.stock || json.data?.inventory || 0;
                    resolve(stock);
                } catch (e) {
                    reject('解析余票失败：' + e.message);
                }
            });
        });
    }

    // 主逻辑
    async function main() {
        if (!sessionId || !priceId) {
            $notification.post('错误', '未找到 sessionId 或 priceId', '');
            return;
        }

        // 检测余票 API
        let stockApi;
        try {
            stockApi = await detectStockApi(sessionId, priceId);
        } catch (e) {
            $notification.post('错误', e.message, '');
            return;
        }

        // 监控余票
        let retryCount = 0;
        while (retryCount < CONFIG.MAX_RETRIES) {
            try {
                const stock = await checkStock(sessionId, priceId, stockApi);
                if (stock > 0) {
                    $notification.post('有票！', `检测到${stock}张票`, '');
                    $persistentStore.write("true", "damai_has_stock");
                    break;
                } else {
                    $notification.post('无票', '继续监控中...', '');
                }
            } catch (e) {
                $notification.post('错误', e, '');
            }
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, CONFIG.CHECK_INTERVAL));
        }
    }

    main();
})();
