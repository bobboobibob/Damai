(function() {
    'use strict';

    // 通知用户脚本已加载
    $notification.post("大麦抢票", "成功", "damai_ticket_bonus.js 已加载，脚本启动成功");

    // 读取用户配置
    const ticketUrl = $persistentStore.read("抢票链接") || "";
    const ticketMode = $persistentStore.read("抢票模式") || "自动";
    const retryCount = parseInt($persistentStore.read("重试次数") || "3");
    let selectedSession = $persistentStore.read("selectedSession") || "";
    let selectedPrice = $persistentStore.read("selectedPrice") || "";

    // 验证抢票链接
    if (!ticketUrl) {
        $notification.post("大麦抢票", "失败", "未设置抢票链接，请在插件配置中输入抢票链接");
        $done();
        return;
    }

    // 解析抢票链接，提取 itemId
    const itemIdMatch = ticketUrl.match(/id=(\d+)/);
    const itemId = itemIdMatch ? itemIdMatch[1] : null;
    if (!itemId) {
        $notification.post("大麦抢票", "失败", "抢票链接无效，无法提取票务ID，请检查链接格式");
        $done();
        return;
    }

    // 通知用户配置信息
    $notification.post("大麦抢票", "提示", `票务ID: ${itemId}, 抢票模式: ${ticketMode}, 重试次数: ${retryCount}`);

    // 全局变量
    let sessionOptions = JSON.parse($persistentStore.read("sessionOptions") || "[]");
    let priceOptions = JSON.parse($persistentStore.read("priceOptions") || "{}");
    let stockInfo = null; // 存储库存信息

    // 1. 获取场次和票价选项
    if (sessionOptions.length === 0 || Object.keys(priceOptions).length === 0) {
        const detailUrl = `https://mtop.damai.cn/h5/mtop.damai.item.detail.get/1.0/?itemId=${itemId}`;
        $notification.post("大麦抢票", "提示", `正在获取场次和票价，请求: ${detailUrl}`);

        // 添加调试通知，确认请求开始
        $notification.post("大麦抢票", "调试", "开始发送场次和票价请求...");

        $httpClient.get({
            url: detailUrl,
            headers: {
                "User-Agent": "Damai/10.2.0 (iPhone; iOS 16.0)",
                "Content-Type": "application/json"
            }
        }, (error, response, data) => {
            if (error) {
                $notification.post("大麦抢票", "失败", `获取场次信息失败，错误: ${error}`);
                $done();
                return;
            }

            if (response.status !== 200) {
                $notification.post("大麦抢票", "失败", `获取场次信息失败，状态码: ${response.status}`);
                $done();
                return;
            }

            // 添加调试通知，确认响应接收
            $notification.post("大麦抢票", "调试", "场次和票价请求成功，状态码: 200");

            try {
                const jsonData = JSON.parse(data);
                if (jsonData.ret && jsonData.ret[0].includes("SUCCESS")) {
                    const sessions = jsonData.data?.performList || [];
                    sessionOptions = [];
                    priceOptions = {};

                    // 提取场次
                    sessions.forEach((session, index) => {
                        const sessionName = session.performName || `场次 ${index + 1}`;
                        const sessionId = session.performId;
                        sessionOptions.push({ sessionId, sessionName });

                        // 提取票价（按场次分组）
                        const skus = session.skuList || [];
                        priceOptions[sessionId] = skus.map(sku => ({
                            skuId: sku.skuId,
                            price: sku.price / 100, // 价格转换为元
                            priceName: sku.priceName || `${sku.price / 100}元`
                        }));
                    });

                    if (sessionOptions.length === 0) {
                        $notification.post("大麦抢票", "失败", "未找到场次，请检查票务ID或稍后重试");
                        $done();
                        return;
                    }

                    // 存储场次和票价选项
                    $persistentStore.write(JSON.stringify(sessionOptions), "sessionOptions");
                    $persistentStore.write(JSON.stringify(priceOptions), "priceOptions");

                    // 展示场次选项
                    let sessionMessage = "场次选项：\n";
                    sessionOptions.forEach((option, index) => {
                        sessionMessage += `${index + 1}. ${option.sessionName} (场次ID: ${option.sessionId})\n`;
                    });
                    sessionMessage += "请手动运行以下脚本保存场次选择（选择编号，例如 1）：\n";
                    sessionMessage += `$persistentStore.write('${sessionOptions[0].sessionName}', 'selectedSession')`;
                    $notification.post("大麦抢票", "提示", sessionMessage);

                    // 展示票价选项（基于第一个场次）
                    const firstSession = sessionOptions[0];
                    const prices = priceOptions[firstSession.sessionId] || [];
                    if (prices.length > 0) {
                        let priceMessage = `场次: ${firstSession.sessionName}\n票价选项：\n`;
                        prices.forEach((price, index) => {
                            priceMessage += `${index + 1}. ${price.priceName} (skuId: ${price.skuId})\n`;
                        });
                        priceMessage += "请手动运行以下脚本保存票价选择（选择编号，例如 1）：\n";
                        priceMessage += `$persistentStore.write('${prices[0].priceName}', 'selectedPrice')`;
                        $notification.post("大麦抢票", "提示", priceMessage);
                    } else {
                        $notification.post("大麦抢票", "失败", `未找到票价，场次: ${firstSession.sessionName}`);
                    }

                    $done();
                } else {
                    $notification.post("大麦抢票", "失败", `获取场次信息失败，错误: ${jsonData.ret?.[0] || "未知错误"}`);
                    $done();
                }
            } catch (e) {
                $notification.post("大麦抢票", "失败", `解析场次数据失败，错误: ${e}`);
                $done();
            }
        });

        $done();
        return;
    }

    // 2. 验证用户选择，若未选择则默认选择第一个场次和最低票价
    if (!selectedSession || !selectedPrice) {
        if (sessionOptions.length > 0) {
            selectedSession = sessionOptions[0].sessionName;
            $persistentStore.write(selectedSession, "selectedSession");
            $notification.post("大麦抢票", "提示", `未选择场次，已默认选择第一个场次: ${selectedSession}`);

            const prices = priceOptions[sessionOptions[0].sessionId] || [];
            if (prices.length > 0) {
                // 按价格排序，选择最低票价
                prices.sort((a, b) => a.price - b.price);
                selectedPrice = prices[0].priceName;
                $persistentStore.write(selectedPrice, "selectedPrice");
                $notification.post("大麦抢票", "提示", `未选择票价，已默认选择最低票价: ${selectedPrice}`);
            }
        } else {
            $notification.post("大麦抢票", "失败", "未找到场次数据，请先获取场次和票价");
            $done();
            return;
        }
    }

    // 查找用户选择的场次和票价对应的 ID
    const selectedSessionObj = sessionOptions.find(opt => opt.sessionName === selectedSession);
    const selectedPriceObj = priceOptions[selectedSessionObj?.sessionId]?.find(price => price.priceName === selectedPrice);

    if (!selectedSessionObj || !selectedPriceObj) {
        $notification.post("大麦抢票", "失败", `场次或票价选择无效，场次: ${selectedSession}, 票价: ${selectedPrice}`);
        $done();
        return;
    }

    const selectedSessionId = selectedSessionObj.sessionId;
    const selectedSkuId = selectedPriceObj.skuId;

    // 3. 监测和处理请求（用户打开大麦客户端后）
    const request = $request;
    const url = request.url;
    const headers = request.headers;
    const body = request.body ? JSON.parse(request.body) : {};

    // 通知用户脚本正在工作
    $notification.post("大麦抢票", "提示", `脚本正在工作，正在监测票务ID: ${itemId}, 场次: ${selectedSession}, 票价: ${selectedPrice}, URL: ${url}`);

    // 提取登录信息（cookie 或 token）
    const cookie = headers["Cookie"] || "";
    const token = headers["Authorization"] || "";

    if (!cookie && !token) {
        $notification.post("大麦抢票", "失败", "未检测到登录信息，请确保已在大麦客户端登录");
        $done();
        return;
    }

    // 4. 监测库存查询请求
    if (url.includes("stock") || url.includes("mtop.damai.item.detail.get")) {
        $notification.post("大麦抢票", "提示", `检测到库存查询请求，URL: ${url}`);

        $httpClient.get({
            url: url,
            headers: headers,
            body: request.body
        }, (error, response, data) => {
            if (error) {
                $notification.post("大麦抢票", "失败", `库存查询失败，错误: ${error}`);
                $done();
                return;
            }

            if (response.status !== 200) {
                $notification.post("大麦抢票", "失败", `库存查询失败，状态码: ${response.status}`);
                $done();
                return;
            }

            try {
                const jsonData = JSON.parse(data);
                stockInfo = {
                    stock: jsonData.data?.stock || 0,
                    itemId: body.itemId || jsonData.data?.itemId || itemId,
                    skuId: body.skuId || jsonData.data?.skuId || selectedSkuId,
                    price: jsonData.data?.price || selectedPriceObj.price * 100 // 转换为分
                };

                if (stockInfo.stock <= 0) {
                    $notification.post("大麦抢票", "警告", `库存不足，票务ID: ${itemId}, 场次: ${selectedSession}, 库存: ${stockInfo.stock}`);
                    $done();
                    return;
                }

                $notification.post("大麦抢票", "成功", `库存查询成功，票务ID: ${itemId}, 场次: ${selectedSession}, 库存: ${stockInfo.stock}, 价格: ${stockInfo.price / 100}元`);

                // 自动模式或快速模式：创建订单
                createOrder();
            } catch (e) {
                $notification.post("大麦抢票", "失败", `解析库存数据失败，错误: ${e}`);
                $done();
            }
        });

        $done();
        return;
    }

    // 5. 默认放行其他请求，并通知
    $notification.post("大麦抢票", "提示", `处理其他请求，URL: ${url}`);
    $done();

    // 6. 创建订单函数
    function createOrder() {
        if (!stockInfo) {
            $notification.post("大麦抢票", "失败", "无法创建订单，未获取库存信息");
            return;
        }

        const orderCreateUrl = "https://mtop.damai.cn/h5/mtop.trade.order.create/1.0/";
        const orderData = {
            itemId: stockInfo.itemId,
            skuId: stockInfo.skuId,
            buyNum: 1, // 默认购买 1 张票
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
                    $notification.post("大麦抢票", "失败", `订单创建失败，错误: ${error}`);
                    if (attempts < retryCount) {
                        $notification.post("大麦抢票", "提示", `正在重试，第 ${attempts + 1} 次尝试`);
                        setTimeout(tryCreateOrder, 1000);
                    } else {
                        $notification.post("大麦抢票", "失败", `订单创建失败，已重试 ${retryCount} 次`);
                    }
                    return;
                }

                if (response.status !== 200) {
                    $notification.post("大麦抢票", "失败", `订单创建失败，状态码: ${response.status}`);
                    if (attempts < retryCount) {
                        $notification.post("大麦抢票", "提示", `正在重试，第 ${attempts + 1} 次尝试`);
                        setTimeout(tryCreateOrder, 1000);
                    } else {
                        $notification.post("大麦抢票", "失败", `订单创建失败，已重试 ${retryCount} 次`);
                    }
                    return;
                }

                try {
                    const jsonData = JSON.parse(data);
                    if (jsonData.ret && jsonData.ret[0].includes("SUCCESS")) {
                        const orderId = jsonData.data?.orderId || "未知";
                        $notification.post("大麦抢票", "成功", `订单创建成功，订单ID: ${orderId}`);
                        submitOrder(orderId);
                    } else {
                        const errorMsg = jsonData.ret?.[0] || "未知错误";
                        $notification.post("大麦抢票", "失败", `订单创建失败，错误: ${errorMsg}`);
                        if (attempts < retryCount) {
                            $notification.post("大麦抢票", "提示", `正在重试，第 ${attempts + 1} 次尝试`);
                            setTimeout(tryCreateOrder, 1000);
                        } else {
                            $notification.post("大麦抢票", "失败", `订单创建失败，已重试 ${retryCount} 次`);
                        }
                    }
                } catch (e) {
                    $notification.post("大麦抢票", "失败", `解析订单创建数据失败，错误: ${e}`);
                }
            });
        }

        tryCreateOrder();
    }

    // 7. 提交订单函数
    function submitOrder(orderId) {
        const orderSubmitUrl = "https://mtop.damai.cn/h5/mtop.trade.order.submit/1.0/";
        const submitData = {
            orderId: orderId
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
                    $notification.post("大麦抢票", "失败", `订单提交失败，错误: ${error}`);
                    if (attempts < retryCount) {
                        $notification.post("大麦抢票", "提示", `正在重试，第 ${attempts + 1} 次尝试`);
                        setTimeout(trySubmitOrder, 1000);
                    } else {
                        $notification.post("大麦抢票", "失败", `订单提交失败，已重试 ${retryCount} 次`);
                    }
                    return;
                }

                if (response.status !== 200) {
                    $notification.post("大麦抢票", "失败", `订单提交失败，状态码: ${response.status}`);
                    if (attempts < retryCount) {
                        $notification.post("大麦抢票", "提示", `正在重试，第 ${attempts + 1} 次尝试`);
                        setTimeout(trySubmitOrder, 1000);
                    } else {
                        $notification.post("大麦抢票", "失败", `订单提交失败，已重试 ${retryCount} 次`);
                    }
                    return;
                }

                try {
                    const jsonData = JSON.parse(data);
                    if (jsonData.ret && jsonData.ret[0].includes("SUCCESS")) {
                        $notification.post("大麦抢票", "成功", `订单提交成功，票务ID: ${itemId}, 场次: ${selectedSession}, 订单ID: ${orderId}`);
                    } else {
                        const errorMsg = jsonData.ret?.[0] || "未知错误";
                        $notification.post("大麦抢票", "失败", `订单提交失败，错误: ${errorMsg}`);
                        if (attempts < retryCount) {
                            $notification.post("大麦抢票", "提示", `正在重试，第 ${attempts + 1} 次尝试`);
                            setTimeout(trySubmitOrder, 1000);
                        } else {
                            $notification.post("大麦抢票", "失败", `订单提交失败，已重试 ${retryCount} 次`);
                        }
                    }
                } catch (e) {
                    $notification.post("大麦抢票", "失败", `解析订单提交数据失败，错误: ${e}`);
                }
            });
        }

        trySubmitOrder();
    }
})();
