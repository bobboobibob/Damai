(function() {
    'use strict';

    // 调试通知
    $notification.post("订单提交", "damai_order.js 已加载", "");

    // 读取 sessionId 和 priceId
    const sessionId = $persistentStore.read("damai_session_id");
    const priceId = $persistentStore.read("damai_price_id");
    const hasStock = $persistentStore.read("damai_has_stock") === "true";

    // 候选订单 API 列表（根据抓包记录推测）
    const ORDER_API_CANDIDATES = [
        'https://api.damai.cn/order/create',
        'https://api.damai.cn/order/submit',
        'https://mtop.damai.cn/h5/mtop.damai.order.create/1.0/',
        'https://api.damai.cn/trade/order/create'
    ];

    // 自动检测订单 API
    async function detectOrderApi(sessionId, priceId) {
        let orderApi = $persistentStore.read("damai_order_api");
        if (orderApi) {
            return orderApi; // 如果已保存，直接返回
        }

        $notification.post("API 检测", "开始检测订单 API", "");
        const testData = {
            itemId: sessionId,
            priceId: priceId,
            quantity: 1,
            buyerInfo: {}, // 假设购票人信息已填写
            source: 'app'
        };

        for (let api of ORDER_API_CANDIDATES) {
            try {
                const response = await new Promise((resolve, reject) => {
                    $httpClient.post({
                        url: api,
                        headers: {
                            'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                            'Content-Type': 'application/json',
                            'Cookie': $persistentStore.read("damai_cookie") || ''
                        },
                        body: JSON.stringify(testData)
                    }, (error, response, data) => {
                        if (error || response.status !== 200) {
                            reject(error || '请求失败');
                        } else {
                            resolve({ response, data });
                        }
                    });
                });

                const json = JSON.parse(response.data);
                // 假设订单 API 响应中包含 "orderId" 或 "result" 字段
                if (json.result || json.orderId) {
                    $persistentStore.write(api, "damai_order_api");
                    $notification.post("API 检测成功", `订单 API: ${api}`, "");
                    return api;
                }
            } catch (e) {
                $notification.post("API 检测失败", `测试 ${api} 失败: ${e}`, "");
            }
        }

        throw new Error("未找到有效的订单 API，请手动抓包确认");
    }

    // 提交订单
    async function submitOrder(sessionId, priceId, orderApi, quantity = 1) {
        const orderData = {
            itemId: sessionId,
            priceId: priceId,
            quantity: quantity,
            buyerInfo: {}, // 假设已填写购票人信息
            source: 'app'
        };
        return new Promise((resolve, reject) => {
            $httpClient.post({
                url: orderApi,
                headers: {
                    'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                    'Content-Type': 'application/json',
                    'Cookie': $persistentStore.read("damai_cookie") || ''
                },
                body: JSON.stringify(orderData)
            }, (error, response, data) => {
                if (error || response.status !== 200) {
                    reject('提交订单失败：' + (error || '未知错误'));
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    if (json.result && json.result.orderId) {
                        resolve(json.result.orderId);
                    } else {
                        reject('订单创建失败：' + (json.msg || '未知错误'));
                    }
                } catch (e) {
                    reject('解析订单响应失败：' + e.message);
                }
            });
        });
    }

    // 主逻辑
    async function main() {
        if (!hasStock) {
            $notification.post('错误', '未检测到余票，订单提交中止', '');
            return;
        }

        if (!sessionId || !priceId) {
            $notification.post('错误', '未找到 sessionId 或 priceId', '');
            return;
        }

        // 检测订单 API
        let orderApi;
        try {
            orderApi = await detectOrderApi(sessionId, priceId);
        } catch (e) {
            $notification.post('错误', e.message, '');
            return;
        }

        // 提交订单
        try {
            const orderId = await submitOrder(sessionId, priceId, orderApi);
            $notification.post('成功', `订单已提交！订单号: ${orderId}\n请打开大麦 App 手动支付`, '');
        } catch (e) {
            $notification.post('错误', e, '');
        }
    }

    main();
})();
