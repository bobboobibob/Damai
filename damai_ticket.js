(function() {
    'use strict';

    // 调试通知：确认脚本是否加载
    $notification.post("脚本加载", "damai_ticket.js 已加载", "");

    // 配置项
    const CONFIG = {
        TICKET_URL: 'https://m.damai.cn/shows/item.html?itemId=902193434418',
        TARGET_DATE: '2025-05-03',
        TARGET_PRICE: '1280',
        MAX_RETRIES: 3,
        CHECK_INTERVAL: 1000,
        NOTIFY_URL: ''
    };

    // 提取 itemId
    function getItemId(url) {
        const match = url.match(/itemId=(\d+)/);
        return match ? match[1] : null;
    }

    // 获取演出信息（测试 API）
    function fetchEventInfo(itemId) {
        const apiUrl = `https://amdc.m.taobao.com/amdc/mobileDispatch?itemId=${itemId}`;
        return new Promise((resolve, reject) => {
            $httpClient.get({
                url: apiUrl,
                headers: {
                    'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                    'Content-Type': 'application/json',
                    'Cookie': $request.headers.Cookie || ''
                }
            }, (error, response, data) => {
                if (error || response.status !== 200) {
                    reject('获取演出信息失败：' + (error || '未知错误'));
                    return;
                }
                try {
                    $notification.post("API 响应", data, "");
                    resolve("演出信息获取成功");
                } catch (e) {
                    reject('解析演出信息失败：' + e.message);
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
        sendNotification("主逻辑启动", "开始执行抢票逻辑", "");

        const itemId = getItemId(CONFIG.TICKET_URL);
        if (!itemId) {
            sendNotification('错误', '无法从抢票链接中提取 itemId');
            return;
        }

        try {
            const eventInfo = await fetchEventInfo(itemId);
            sendNotification('演出信息', eventInfo);
        } catch (e) {
            sendNotification('错误', e);
        }
    }

    // 直接执行主逻辑
    main();
})();
