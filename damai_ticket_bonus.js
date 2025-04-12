(function() {
    'use strict';

    $notification.post("抢票脚本", "damai_ticket_bonus.js 已加载", "");

    const CONFIG = {
        TICKET_URL: 'https://m.damai.cn/shows/item.html?itemId=902193434418',
        TARGET_DATE: '2025-05-03',
        TARGET_PRICE: '1280',
        MAX_RETRIES: 3,
        CHECK_INTERVAL: 1000
    };

    const STOCK_API_CANDIDATES = [
        'https://mtop.damai.cn/h5/mtop.damai.ticket.inventory.query/1.0/'
    ];
    const ORDER_API_CANDIDATES = [
        'https://mtop.damai.cn/h5/mtop.damai.order.create/1.0/'
    ];

    // 读取动态策略
    const policy = $persistentStore.read("damai_policy") || 'DIRECT';

    if ($request && $request.headers && $request.headers.Cookie) {
        $persistentStore.write($request.headers.Cookie, "damai_cookie");
        $notification.post("Cookie 获取", "已保存 Cookie", "");
    }

    function getItemId(url) {
        const match = url.match(/itemId=(\d+)/);
        return match ? match[1] : null;
    }

    function fetchEventInfo(itemId) {
        const apiUrl = `https://api.damai.cn/item/detail.getdetail.2.0?itemId=${itemId}`;
        return new Promise((resolve, reject) => {
            $httpClient.get({
                url: apiUrl,
                policy: policy,
                headers: {
                    'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                    'Content-Type': 'application/json',
                    'Cookie': $persistentStore.read("damai_cookie") || ''
                }
            }, (error, response, data) => {
                if (error || response.status !== 200) {
                    reject('获取演出信息失败：' + (error || '未知错误'));
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    let info = `演出名称: ${json.data?.itemName || '未知'}\n场次:\n`;
                    const sessions = json.data?.performList || [];
                    const prices = json.data?.priceList || [];
                    sessions.forEach(s => {
                        info += `- ${s.performTime} (ID: ${s.performId})\n`;
                    });
                    info += '票价:\n';
                    prices.forEach(p => {
                        info += `- ${p.price}元 (ID: ${p.priceId})\n`;
                    });

                    let matchedSession = sessions.find(s => s.performTime.includes(CONFIG.TARGET_DATE));
                    let matchedPrice = prices.find(p => p.price == CONFIG.TARGET_PRICE);

                    if (!matchedSession || !matchedPrice) {
                        reject(`未找到匹配的场次或票价：${CONFIG.TARGET_DATE}, ${CONFIG.TARGET_PRICE}元`);
                        return;
                    }

                    $persistentStore.write(matchedSession.performId, "damai_session_id");
                    $persistentStore.write(matchedPrice.priceId, "damai_price_id");
                    resolve(info);
                } catch (e) {
                    reject('解析演出信息失败：' + e.message);
                }
            });
        });
    }

    async function detectStockApi(sessionId, priceId) {
        let stockApi = $persistentStore.read("damai_stock_api");
        if (stockApi) return stockApi;

        $notification.post("API 检测", "开始检测余票 API", "");
        for (let api of STOCK_API_CANDIDATES) {
            try {
                const testUrl = `${api}?sessionId=${sessionId}&priceId=${priceId}`;
                const response = await new Promise((resolve, reject) => {
                    $httpClient.get({
                        url: testUrl,
                        policy: policy,
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

    async function checkStock(sessionId, priceId, stockApi) {
        const stockUrl = `${stockApi}?sessionId=${sessionId}&priceId=${priceId}`;
        return new Promise((resolve, reject) => {
            $httpClient.get({
                url: stockUrl,
                policy: policy,
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

    async function detectOrderApi(sessionId, priceId) {
        let orderApi = $persistentStore.read("damai_order_api");
        if (orderApi) return orderApi;

        $notification.post("API 检测", "开始检测订单 API", "");
        const testData = {
            itemId: sessionId,
            priceId: priceId,
            quantity: 1,
            buyerInfo: {},
            source: 'app'
        };

        for (let api of ORDER_API_CANDIDATES) {
            try {
                const response = await new Promise((resolve, reject) => {
                    $httpClient.post({
                        url: api,
                        policy: policy,
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

    async function submitOrder(sessionId, priceId, orderApi) {
        const orderData = {
            itemId: sessionId,
            priceId: priceId,
            quantity: 1,
            buyerInfo: {},
            source: 'app'
        };
        return new Promise((resolve, reject) => {
            $httpClient.post({
                url: orderApi,
                policy: policy,
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

    async function main() {
        const itemId = getItemId(CONFIG.TICKET_URL);
        if (!itemId) {
            $notification.post('错误', '无法从抢票链接中提取 itemId', '');
            $done();
            return;
        }

        let eventInfo;
        try {
            eventInfo = await fetchEventInfo(itemId);
            $notification.post('演出信息', eventInfo, '');
        } catch (e) {
            $notification.post('错误', e, '');
            $done();
            return;
        }

        const sessionId = $persistentStore.read("damai_session_id");
        const priceId = $persistentStore.read("damai_price_id");

        let stockApi;
        try {
            stockApi = await detectStockApi(sessionId, priceId);
        } catch (e) {
            $notification.post('错误', e.message, '');
            $done();
            return;
        }

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

        if ($persistentStore.read("damai_has_stock") === "true") {
            let orderApi;
            try {
                orderApi = await detectOrderApi(sessionId, priceId);
            } catch (e) {
                $notification.post('错误', e.message, '');
                $done();
                return;
            }

            try {
                const orderId = await submitOrder(sessionId, priceId, orderApi);
                $notification.post('成功', `订单已提交！订单号: ${orderId}\n请打开大麦 App 手动支付`, '');
            } catch (e) {
                $notification.post('错误', e, '');
            }
        }

        $done();
    }

    main();
})();
