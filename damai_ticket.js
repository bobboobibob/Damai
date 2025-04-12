function checkStock(sessionId, priceId) {
    const stockUrl = `https://api.damai.cn/ticket/inventory.query?sessionId=${sessionId}&priceId=${priceId}`;
    return new Promise((resolve, reject) => {
        $httpClient.get({
            url: stockUrl,
            headers: {
                'User-Agent': 'Damai/10.2.0 (iPhone; iOS 16.0)',
                'Content-Type': 'application/json',
                'Cookie': $request.headers.Cookie || ''
            }
        }, (error, response, data) => {
            if (error || response.status !== 200) {
                reject('获取余票失败：' + (error || '未知错误'));
                return;
            }
            try {
                const json = JSON.parse(data);
                $notification.post("余票响应", JSON.stringify(json), "");
                resolve(json.data?.stock || 0);
            } catch (e) {
                reject('解析余票失败：' + e.message);
            }
        });
    });
}
