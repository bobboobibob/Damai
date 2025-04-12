(function() {
    'use strict';

    // 读取用户配置（使用中文键名）
    const ticketTarget = $persistentStore.read("抢票目标") || "未设置抢票目标";
    const userId = $persistentStore.read("用户ID") || "未设置用户ID";
    const ticketMode = $persistentStore.read("抢票模式") || "自动";
    const retryCount = parseInt($persistentStore.read("重试次数") || "3");

    // 通知用户脚本已加载
    $notification.post("大麦抢票", "damai_ticket_bonus.js 已加载", `抢票目标: ${ticketTarget}, 抢票模式: ${ticketMode}, 重试次数: ${retryCount}`);

    // 全局变量，用于存储库存信息
    let stockInfo = null;

    // 监测和处理请求
    const request = $request;
    const url = request.url;
    const headers = request.headers;
    const body = request.body ? JSON.parse(request.body) : {};

    // 1. 监测库存查询请求
    if (url.includes("stock") || url.includes("mtop.damai.item.detail.get")) {
        $notification.post("大麦抢票", "检测到库存查询请求", `URL: ${url}`);

        // 模拟库存查询响应（实际中需要等待服务器响应，这里直接处理请求）
        $httpClient.get({
            url: url,
            headers: headers,
            body: request.body
        }, (error, response, data) => {
            if (error) {
                $notification.post("大麦抢票错误", "库存查询失败", `错误: ${error}`);
                $done();
                return;
            }

            if (response.status !== 200) {
                $notification.post("大麦抢票错误", "库存查询失败", `状态码: ${response.status}`);
                $done();
                return;
            }

            try {
                const jsonData = JSON.parse(data);
                // 假设库存信息在 jsonData.data.stock 中
                stockInfo = {
                    stock: jsonData.data?.stock || 0,
                    itemId: body.itemId || jsonData.data?.itemId || "未知",
                    skuId: body.skuId || jsonData.data?.skuId || "未知",
                    price: jsonData.data?.price || 0
                };

                if (stockInfo.stock <= 0) {
                    $notification.post("大麦抢票警告", "库存不足", `抢票目标: ${ticketTarget}, 库存: ${stockInfo.stock}`);
                    $done();
                    return;
                }

                $notification.post("大麦抢票", "库存查询成功", `抢票目标: ${ticketTarget}, 库存: ${stockInfo.stock}, 价格: ${stockInfo.price}`);

                // 根据抢票模式处理
                if (ticketMode === "手动") {
                    $notification.post("大麦抢票提示", "请手动提交订单", `库存充足: ${stockInfo.stock}`);
                    $done();
                    return;
                }

                // 自动模式或快速模式：创建订单
                createOrder();
            } catch (e) {
                $notification.post("大麦抢票错误", "解析库存数据失败", `错误: ${e}`);
                $done();
            }
        });

        // 等待异步请求完成
        $done();
        return;
    }

    // 2. 监测订单创建或提交请求（防止重复处理）
    if (url.includes("order/create") || url.includes("mtop.trade.order.create")) {
        $notification.post("大麦抢票", "检测到订单创建请求", `URL: ${url}`);
        $done(); // 直接放行，订单创建由脚本控制
        return;
    }

    if (url.includes("order/submit") || url.includes("mtop.trade.order.submit")) {
        $notification.post("大麦抢票", "检测到订单提交请求", `URL: ${url}`);
        $done(); // 直接放行，订单提交由脚本控制
        return;
    }

    // 3. 默认放行其他请求
    $done();

    // 4. 创建订单函数
    function createOrder() {
        if (!stockInfo) {
            $notification.post("大麦抢票错误", "无法创建订单", "未获取库存信息");
            return;
        }

        const orderCreateUrl = "https://mtop.damai.cn/h5/mtop.trade.order.create/1.0/";
        const orderData = {
            itemId: stockInfo.itemId,
            skuId: stockInfo.skuId,
            buyNum: 1, // 默认购买 1 张票，可根据需求调整
            userId: userId,
            price: stockInfo.price
        };

        let attempts = 0;
        function tryCreateOrder() {
            attempts++;
            $httpClient.post({
                url: orderCreateUrl,
                headers: {
                    ...headers,
                    "Content-Type": "application/json",
                    "User-Agent": "Damai/10.2.0 (iPhone; iOS 16.0)"
                },
                body: JSON.stringify(orderData)
            }, (error, response, data) => {
                if (error) {
                    $notification.post("大麦抢票错误", "订单创建失败", `错误: ${error}`);
                    if (attempts < retryCount) {
                        $notification.post("大麦抢票", "正在重试", `第 ${attempts + 1} 次尝试`);
                        setTimeout(tryCreateOrder, 1000); // 1 秒后重试
                    } else {
                        $notification.post("大麦抢票失败", "订单创建失败", `已重试 ${retryCount} 次`);
                    }
                    return;
                }

                if (response.status !== 200) {
                    $notification.post("大麦抢票错误", "订单创建失败", `状态码: ${response.status}`);
                    if (attempts < retryCount) {
                        $notification.post("大麦抢票", "正在重试", `第 ${attempts + 1} 次尝试`);
                        setTimeout(tryCreateOrder, 1000);
                    } else {
                        $notification.post("大麦抢票失败", "订单创建失败", `已重试 ${retryCount} 次`);
                    }
                    return;
                }

                try {
                    const jsonData = JSON.parse(data);
                    if (jsonData.ret && jsonData.ret[0].includes("SUCCESS")) {
                        const orderId = jsonData.data?.orderId || "未知";
                        $notification.post("大麦抢票", "订单创建成功", `订单ID: ${orderId}`);
                        submitOrder(orderId);
                    } else {
                        const errorMsg = jsonData.ret?.[0] || "未知错误";
                        $notification.post("大麦抢票错误", "订单创建失败", `错误: ${errorMsg}`);
                        if (attempts < retryCount) {
                            $notification.post("大麦抢票", "正在重试", `第 ${attempts + 1} 次尝试`);
                            setTimeout(tryCreateOrder, 1000);
                        } else {
                            $notification.post("大麦抢票失败", "订单创建失败", `已重试 ${retryCount} 次`);
                        }
                    }
                } catch (e) {
                    $notification.post("大麦抢票错误", "解析订单创建数据失败", `错误: ${e}`);
                }
            });
        }

        tryCreateOrder();
    }

    // 5. 提交订单函数
    function submitOrder(orderId) {
        const orderSubmitUrl = "https://mtop.damai.cn/h5/mtop.trade.order.submit/1.0/";
        const submitData = {
            orderId: orderId,
            userId: userId
        };

        let attempts = 0;
        function trySubmitOrder() {
            attempts++;
            $httpClient.post({
                url: orderSubmitUrl,
                headers: {
                    ...headers,
                    "Content-Type": "application/json",
                    "User-Agent": "Damai/10.2.0 (iPhone; iOS 16.0)"
                },
                body: JSON.stringify(submitData)
            }, (error, response, data) => {
                if (error) {
                    $notification.post("大麦抢票错误", "订单提交失败", `错误: ${error}`);
                    if (attempts < retryCount) {
                        $notification.post("大麦抢票", "正在重试", `第 ${attempts + 1} 次尝试`);
                        setTimeout(trySubmitOrder, 1000);
                    } else {
                        $notification.post("大麦抢票失败", "订单提交失败", `已重试 ${retryCount} 次`);
                    }
                    return;
                }

                if (response.status !== 200) {
                    $notification.post("大麦抢票错误", "订单提交失败", `状态码: ${response.status}`);
                    if (attempts < retryCount) {
                        $notification.post("大麦抢票", "正在重试", `第 ${attempts + 1} 次尝试`);
                        setTimeout(trySubmitOrder, 1000);
                    } else {
                        $notification.post("大麦抢票失败", "订单提交失败", `已重试 ${retryCount} 次`);
                    }
                    return;
                }

                try {
                    const jsonData = JSON.parse(data);
                    if (jsonData.ret && jsonData.ret[0].includes("SUCCESS")) {
                        $notification.post("大麦抢票成功", "订单提交成功", `抢票目标: ${ticketTarget}, 订单ID: ${orderId}`);
                    } else {
                        const errorMsg = jsonData.ret?.[0] || "未知错误";
                        $notification.post("大麦抢票错误", "订单提交失败", `错误: ${errorMsg}`);
                        if (attempts < retryCount) {
                            $notification.post("大麦抢票", "正在重试", `第 ${attempts + 1} 次尝试`);
                            setTimeout(trySubmitOrder, 1000);
                        } else {
                            $notification.post("大麦抢票失败", "订单提交失败", `已重试 ${retryCount} 次`);
                        }
                    }
                } catch (e) {
                    $notification.post("大麦抢票错误", "解析订单提交数据失败", `错误: ${e}`);
                }
            });
        }

        trySubmitOrder();
    }
})();
