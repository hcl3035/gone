(function() {
    function initWallCopy() {
        const textarea = document.getElementById('wallContent');
        if (!textarea) {
            console.warn('wallContent textarea not found');
            return;
        }

        textarea.addEventListener('mouseup', function() {
            const selectedText = textarea.value.substring(
                textarea.selectionStart,
                textarea.selectionEnd
            );

            if (!selectedText || selectedText.trim() === '') {
                return;
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(selectedText).then(function() {
                    showCopyNotification();
                }).catch(function(err) {
                    console.error('Failed to copy: ', err);
                    fallbackCopy(selectedText);
                });
            } else {
                fallbackCopy(selectedText);
            }
        });

        function fallbackCopy(text) {
            const tempTextarea = document.createElement('textarea');
            tempTextarea.value = text;
            tempTextarea.style.position = 'fixed';
            tempTextarea.style.left = '-9999px';
            document.body.appendChild(tempTextarea);
            tempTextarea.select();

            try {
                document.execCommand('copy');
                showCopyNotification();
            } catch (err) {
                console.error('Fallback copy failed: ', err);
            }

            document.body.removeChild(tempTextarea);
        }

        function showCopyNotification() {
            let notification = document.getElementById('copyNotification');
            if (!notification) {
                notification = document.createElement('div');
                notification.id = 'copyNotification';
                notification.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: #4CAF50;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 4px;
                    z-index: 10000;
                    font-size: 14px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                notification.textContent = '已复制选中内容';
                document.body.appendChild(notification);
            }

            notification.style.opacity = '1';
            setTimeout(function() {
                notification.style.opacity = '0';
            }, 1500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWallCopy);
    } else {
        initWallCopy();
    }
})();