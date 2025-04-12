(function() {
    'use strict';

    // 调试通知
    $notification.post("脚本加载", "damai_ticket.js 已加载", "");

    // 添加可视化输出
    $ui.render({
        props: {
            title: "大麦抢票"
        },
        views: [
            {
                type: "label",
                props: {
                    text: "脚本已加载，正在监控余票...",
                    font: $font(16),
                    textColor: $color("#000000"),
                    align: $align.center
                },
                layout: function(make, view) {
                    make.center.equalTo(view.super);
                    make.width.equalTo(view.super);
                }
            }
        ]
    });
})();
