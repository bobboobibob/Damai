(function() {
    'use strict';

    // 调试通知
    $notification.post("界面加载", "damai_ui.js 已加载", "如果看到此通知，说明脚本已运行");

    // 简单界面
    $ui.render({
        props: {
            title: "大麦抢票"
        },
        views: [
            {
                type: "label",
                props: {
                    text: "脚本已加载！",
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
