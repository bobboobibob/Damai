// ==UserScript==
// @name         Damai Ticket Monitor and Auto-Submit
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动监测大麦iOS客户端余票并提交订单
// @author       Grok
// @match        *.damai.cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 配置项（用户需修改）
    const CONFIG = {
        TICKET_URL: 'https://m.damai.cn/shows/item.html?itemId=902193434418', // 抢票链接，例如：https://detail.damai.cn/item.htm?id=123456
        TARGET_DATE: '2025-05-03', // 目标场次日期，例如：2025-05-01
        TARGET_PRICE: '1280', // 目标票价，例如：580
        MAX_RETRIES: 3, // 最大重试次数
        CHECK_INTERVAL: 200, // 监控间隔（毫秒，建议1-2秒）
        NOTIFY_URL: '' // 可选：Bark通知URL，例如：https://api.day.app/your_key/
    };

    // 全局变量
    let retryCount = 0;
    let isRunning = false;

    // 获取演出信息
    function fetchEventInfo(url) {
        return new Promise((resolve, reject) => {
            $httpClient.get({
                url: url,
                headers: {
                    'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                    'Cookie': $request.headers.Cookie || ''
                }
            }, (error, response, data) => {
                if (error || response.status !== 200) {
                    reject('获取演出信息失败');
                    return;
                }
                try {
                    // 假设API返回JSON，提取场次和票价
                    const json = JSON.parse(data);
                    const sessions = json.data.sessions || [];
                    const prices = json.data.prices || [];
                    let info = `演出名称: ${json.data.title}\n场次:\n`;
                    sessions.forEach(s => {
                        info += `- ${s.date} (ID: ${s.id})\n`;
                    });
                    info += '票价:\n';
                    prices.forEach(p => {
                        info += `- ${p.price}元 (ID: ${p.id})\n`;
                    });
                    resolve(info);
                } catch (e) {
                    reject('解析演出信息失败');
                }
            });
        });
    }

    // 监测余票
    function checkStock(sessionId, priceId) {
        const stockUrl = `https://mtop.damai.cn/h5/mtop.damai.item.tickets/1.0/?itemId=${sessionId}&priceId=${priceId}`;
        return new Promise((resolve, reject) => {
            $httpClient.get({
                url: stockUrl,
                headers: {
                    'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                    'Cookie': $request.headers.Cookie || ''
               不仅是
                    'Content-Type': 'application/json',
                    'Cookie': $request.headers.Cookie || ''
                }
            }, (error, response, data) => {
                if (error || response.status !== 200) {
                    retryCount++;
                    if (retryCount < CONFIG.MAX_RETRIES) {
                        setTimeout(() => checkStock(sessionId, priceId), CONFIG.CHECK_INTERVAL);
                        return;
                    }
                    reject('网络错误，重试失败');
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    if (json.result && json.result.stock > 0) {
                        resolve(json.result.stock);
                    } else {
                        resolve(0);
                    }
                } catch (e) {
                    reject('解析库存失败');
                }
            });
        });
    }

    // 提交订单
    function submitOrder(sessionId, priceId, quantity = 1) {
        const orderUrl = 'https://mtop.damai.cn/h5/mtop.trade.order.create/1.0/';
        const orderData = {
            itemId: sessionId,
            priceId: priceId,
            quantity: quantity,
            buyerInfo: {}, // 假设已填写购票人信息
            source: 'app'
        };
        return new Promise((resolve, reject) => {
            $httpClient.post({
                url: orderUrl,
                headers: {
                    'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                    'Content-Type': 'application/json',
                    'Cookie': $request.headers.Cookie || ''
                },
                body: JSON.stringify(orderData)
            }, (error, response, data) => {
                if (error || response.status !== 200) {
                    reject('提交订单失败');
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    if (json.result && json.result.orderId) {
                        resolve(json.result.orderId);
                    } else {
                        reject('订单创建失败');
                    }
                } catch (e) {
                    reject('解析订单响应失败');
                }
            });
        });
    }

    // 发送通知
    function sendNotification(title, message) {
        if (CONFIG.NOTIFY_URL) {
            $httpClient.post({
                url: CONFIG.NOTIFY_URL,
                body: JSON.stringify({ title, body: message })
            });
        }
        $notification.post(title, message, '');
    }

    // 主逻辑
    async function main() {
        if (!CONFIG.TICKET_URL) {
            sendNotification('错误', '请配置抢票链接');
            return;
        }
        if (!CONFIG.TARGET_DATE || !CONFIG.TARGET_PRICE) {
            try {
                const eventInfo = await fetchEventInfo(CONFIG.TICKET_URL);
                sendNotification('演出信息', `请根据以下信息设置TARGET_DATE和TARGET_PRICE:\n${eventInfo}`);
            } catch (e) {
                sendNotification('错误', e);
            }
            return;
        }
        if (isRunning) return;
        isRunning = true;
        try {
            // 假设sessionId和priceId通过配置简化，实际需抓包确认
            const sessionId = CONFIG.TARGET_DATE; // 需替换为实际ID
            const priceId = CONFIG.TARGET_PRICE;  // 需替换为实际ID
            while (isRunning) {
                try {
                    const stock = await checkStock(sessionId, priceId);
                    if (stock > 0) {
                        sendNotification('有票！', `检测到${stock}张票，正在提交订单...`);
                        const orderId = await submitOrder(sessionId, priceId);
                        sendNotification('成功', `订单已提交！订单号: ${orderId}\n请打开大麦App手动支付`);
                        isRunning = false;
                        break;
                    } else {
                        sendNotification('无票', '继续监控中...');
                    }
                } catch (e) {
                    sendNotification('错误', e);
                }
                await new Promise(resolve => setTimeout(resolve, CONFIG.CHECK_INTERVAL + Math.random() * 500));
            }
        } catch (e) {
            sendNotification('错误', e);
        } finally {
            isRunning = false;
        }
    }

    // 启动脚本
    main();
})();
