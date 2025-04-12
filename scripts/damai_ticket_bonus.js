(function() {
    'use strict';

    // 读取用户配置
    const ticketUrl = $persistentStore.read("抢票链接") || "";
    const userId = $persistentStore.read("用户ID") || "未设置用户ID";
    const ticketMode = $persistentStore.read("抢票模式") || "自动";
    const retryCount = parseInt($persistentStore.read("重试次数") || "3");

    // 验证抢票链接
    if (!ticketUrl) {
        $notification.post("大麦抢票错误", "未设置抢票链接", "请在插件配置中输入抢票链接");
        $done();
        return;
    }

    // 解析抢票链接，提取 itemId
    const itemIdMatch = ticketUrl.match(/id=(\d+)/);
    const itemId = itemIdMatch ? itemIdMatch[1] : null;
    if (!itemId) {
        $notification.post("大麦抢票错误", "抢票链接无效", "无法提取票务ID，请检查链接格式");
        $done();
        return;
    }

    // 通知用户脚本已加载
    $notification.post("大麦抢票", "damai_ticket_bonus.js 已加载", `票务ID: ${itemId}, 抢票模式: ${ticketMode}, 重试次数: ${retryCount}`);

    // 全局变量
    let sessionOptions = null; // 存储场次和票价选项
    let selectedSkuId = $persistentStore.read("selectedSkuId"); // 用户选择的票档（skuId）
    let stockInfo = null; // 存储库存信息

    // 1. 获取场次和票价选项
    if (!sessionOptions) {
        const detailUrl = `https://mtop.damai.cn/h5/mtop.damai.item.detail.get/1.0/?itemId=${itemId}`;
        $httpClient.get({
            url: detailUrl,
            headers: {
                "User-Agent": "Damai/10.2.0 (iPhone; iOS 16.0)",
                "Content-Type": "application/json"
            }
        }, (error, response, data) => {
            if (error) {
                $notification.post("大麦抢票错误", "获取场次信息失败", `错误: ${error}`);
                $done();
                return;
            }

            if (response.status !== 200) {
                $notification.post("大麦抢票错误", "获取场次信息失败", `状态码: ${response.status}`);
                $done();
                return;
            }

            try {
                const jsonData = JSON.parse(data);
                if (jsonData.ret && jsonData.ret[0].includes("SUCCESS")) {
                    const sessions = jsonData.data?.performList || [];
                    sessionOptions = [];

                    sessions.forEach((session, index) => {
                        const sessionName = session.performName || `场次 ${index + 1}`;
                        const skus = session.skuList || [];
                        skus.forEach(sku => {
                            sessionOptions.push({
                                sessionId: session.performId,
                                sessionName: sessionName,
                                skuId: sku.skuId,
                                price: sku.price / 100, // 价格通常以分为单位，转换为元
                                priceName: sku.priceName || `${sku.price / 100}元`
                            });
                        });
                    });

                    if (sessionOptions.length === 0) {
                        $notification.post("大麦抢票错误", "未找到场次或票价", "请检查票务ID或稍后重试");
                        $done();
                        return;
                    }

                    // 展示场次和票价选项
                    let optionsMessage = "请选择场次和票价：\n";
                    sessionOptions.forEach((option, index) => {
                        optionsMessage += `${index + 1}. ${option.sessionName} - ${option.priceName} (skuId: ${option.skuId})\n`;
                    });
                    optionsMessage += "请回复选项编号（例如 1）到脚本日志或通过其他方式保存选择";

                    $notification.post("大麦抢票", "场次和票价选项", optionsMessage);

                    // 假设用户通过某种方式选择（这里需要手动保存选择，实际中可能需要其他交互方式）
                    // 例如：用户选择后，通过 $persistentStore.write 保存
                    // 由于 Loon 脚本无法直接交互，这里假设用户手动保存 selectedSkuId
                    $done();
                } else {
                    $notification.post("大麦抢票错误", "获取场次信息失败", `错误: ${jsonData.ret?.[0] || "未知错误"}`);
                    $done();
                }
            } catch (e) {
                $notification.post("大麦抢票错误", "解析场次数据失败", `错误: ${e}`);
                $done();
            }
        });

        $done();
        return;
    }

    // 2. 监测和处理请求（用户打开大麦客户端后）
    const request = $request;
    const url = request.url;
    const headers = request.headers;
    const body = request.body ? JSON.parse(request.body) : {};

    // 提取登录信息（cookie 或 token）
    const cookie = headers["Cookie"] || "";
    const token = headers["Authorization"] || "";

    if (!cookie && !token) {
        $notification.post("大麦抢票错误", "未检测到登录信息", "请确保已在大麦客户端登录");
        $done();
        return;
    }

    // 3. 监测库存查询请求
    if (url.includes("stock") || url.includes("mtop.damai.item.detail.get")) {
        $notification.post("大麦抢票", "检测到库存查询请求", `URL: ${url}`);

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
                stockInfo = {
                    stock: jsonData.data?.stock || 0,
                    itemId: body.itemId || jsonData.data?.itemId || itemId,
                    skuId: body.skuId || jsonData.data?.skuId || selectedSkuId,
                    price: jsonData.data?.price || 0
                };

                if (stockInfo.stock <= 0) {
                    $notification.post("大麦抢票警告", "库存不足", `票务ID: ${itemId}, 库存: ${stockInfo.stock}`);
                    $done();
                    return;
                }

                $notification.post("大麦抢票", "库存查询成功", `票务ID: ${itemId}, 库存: ${stockInfo.stock}, 价格: ${stockInfo.price / 100}元`);

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

        $done();
        return;
    }

    // 4. 默认放行其他请求
    $done();

    // 5. 创建订单函数
    function createOrder() {
        if (!stockInfo) {
            $notification.post("大麦抢票错误", "无法创建订单", "未获取库存信息");
            return;
        }

        if (!selectedSkuId) {
            $notification.post("大麦抢票错误", "未选择票档", "请先选择场次和票价");
            return;
        }

        const orderCreateUrl = "https://mtop.damai.cn/h5/mtop.trade.order.create/1.0/";
        const orderData = {
            itemId: stockInfo.itemId,
            skuId: selectedSkuId,
            buyNum: 1, // 默认购买 1 张票
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
                        setTimeout(tryCreateOrder, 1000);
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

    // 6. 提交订单函数
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
                        $notification.post("大麦抢票成功", "订单提交成功", `票务ID: ${itemId}, 订单ID: ${orderId}`);
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
