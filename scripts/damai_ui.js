(function() {
    'use strict';

    // 通知用户脚本已加载
    $notification.post("大麦票务检测", "成功", "damai_ui.js 已加载，准备修改抢票按钮");

    // 获取库存状态
    const hasStock = $persistentStore.read("hasStock") === "true";

    // 获取响应体
    let body = $response.body;

    // 注入 JavaScript 代码，修改抢票按钮
    if (hasStock) {
        const script = `
            <script>
                (function() {
                    // 等待 DOM 加载完成
                    document.addEventListener('DOMContentLoaded', function() {
                        // 找到抢票按钮（根据大麦客户端的 DOM 结构）
                        let buyButton = document.querySelector('.buy-btn') || 
                                       document.querySelector('button[data-spm="dconfirm"]') ||
                                       document.querySelector('button[class*="buy"]');
                        
                        if (buyButton) {
                            // 移除禁用属性
                            buyButton.removeAttribute('disabled');
                            // 修改样式，使按钮可点击
                            buyButton.style.opacity = '1';
                            buyButton.style.backgroundColor = '#ff4d4f'; // 红色背景，表示可点击
                            buyButton.innerText = '立即抢票（有票！）';
                            
                            // 添加点击事件，确认修改成功
                            buyButton.addEventListener('click', function() {
                                alert('抢票按钮已启用，请尽快点击！');
                            });

                            // 通知用户
                            setTimeout(function() {
                                $notification.post("大麦票务检测", "成功", "抢票按钮已变为可点击，请尽快点击！");
                            }, 1000);
                        } else {
                            // 如果未找到按钮，通知用户
                            $notification.post("大麦票务检测", "失败", "未找到抢票按钮，请检查页面 DOM 结构");
                        }
                    });
                })();
            </script>
        `;

        // 将脚本注入到页面
        body = body.replace('</body>', `${script}</body>`);
    } else {
        $notification.post("大麦票务检测", "提示", "暂无库存，抢票按钮保持禁用状态");
    }

    $done({ body });
})();
