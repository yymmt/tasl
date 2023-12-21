// ==UserScript==
// @name         Slack見落としチェッカー
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://app.slack.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=slack.com
// @grant        none
// @updateURL    https://raw.githubusercontent.com/yymmt/tasl/main/slack-checker.user.js
// @downloadURL  https://raw.githubusercontent.com/yymmt/tasl/main/slack-checker.user.js
// ==/UserScript==
// @see          アイコン素材 : http://www.small-icons.com/packs/24x24-free-application-icons.htm

let wait = async(t) => await new Promise(resolve => setTimeout(resolve, t));
(async function () {
    let query = (selector,elm=document) => Array.from(elm.querySelectorAll(selector));
    let init = () => {
        let stl=document.createElement("style");
        stl.innerHTML=`
            .p-channel_sidebar__channel--unread,
            .p-channel_sidebar__channel--unread.p-channel_sidebar__channel--selected {
                background-color: lightgray;
            }
            .p-ia4_channel_list .p-channel_sidebar__channel--selected:not(.p-channel_sidebar__channel--unread),
            .p-ia4_channel_list .p-channel_sidebar__channel--selected:not(.p-channel_sidebar__channel--unread):hover {
                background-color: #8d7edc;
            }
            .ta__channel-panel {
                position: absolute;
                top: 1px;
                bottom: 1px;
                right: 9px;
                background: black;
                padding: 0px 4px;
                display: flex;
                gap: 2px;
                color: white;
                border-radius: 4px;
            }
            .ta__channel-panel .ta__mentor-name {
                position: relative;
                width: 90px;
                overflow: hidden;
                white-space: nowrap;
                line-height: 25px;
                font-size: 15px;
            }
            .ta__channel-panel .ta__mentor-name:after {
                content: "";
                position: absolute;
                right: 0;
                top: 0;
                bottom: 0;
                width: 16px;
                display: block;
                background-image: linear-gradient(90deg, transparent,black);
            }
            .ta__channel-panel img {
                width: 20px;
                height: 20px;
                margin-top: 4px;
            }
            .ta__channel-panel img.ta__disabled {
                filter: brightness(0.2);
            }
            .ta__channel-panel img.ta__disabled.ta__clickable:hover {
                filter: brightness(0.5);
                background: #555;
                outline: 2px solid #666;
            }

            .ta__channel-panel .ta__small-icons {
                display: flex;
                flex-direction: column;
                flex-wrap: wrap;
                gap: 2px;
            }
            .ta__channel-panel .ta__small-icons img {
                width: 12px;
                height: 12px;
                margin-top: 0px;
            }
        `;
        document.body.append(stl);
    }

    let data = localStorage.getItem("techacademy-senderchecker");
    data = data ? JSON.parse(data) : {};
    let saveLocalStorage = ()=>localStorage.setItem("techacademy-senderchecker", JSON.stringify(data));
    let digCh = (cn) => {
        if(!data[cn]) data[cn]={sender:"", mentor:"", ts:0, mentorts:0};
        return data[cn];
    };
    let updateSide = (elm) => {
        let cn=elm.textContent;
        let ch=data[cn];
        if(ch) {
            let parent = elm.parentElement;
            let panel = query(".ta__channel-panel",parent)[0];
            if(!panel) {
                panel = document.createElement("span");
                panel.classList.add("ta__channel-panel");
                panel.innerHTML = `
                    <img src="https://raw.githubusercontent.com/yymmt/tasl/main/icon/Exit.png" alt="本日ご新規(15時か19時をまたいで最初の発言)" class="ta__newcomer-icon">
                    <img src="https://raw.githubusercontent.com/yymmt/tasl/main/icon/People.png" alt="最後に受講生が発言した" class="ta__student-icon">
                    <img src="https://raw.githubusercontent.com/yymmt/tasl/main/icon/Boss.png" alt="最後にメンターが発言した" class="ta__mentor-icon">
                    <span class="ta__mentor-name"></span>
                    <img src="https://raw.githubusercontent.com/yymmt/tasl/main/icon/Question.png" alt="未判定" class="ta__unsolved-icon ta__clickable">
                    <img src="https://raw.githubusercontent.com/yymmt/tasl/main/icon/Apply.png" alt="会話が完結" class="ta__solved-icon ta__clickable">
                    <span class="ta__small-icons">
                        <img src="https://raw.githubusercontent.com/yymmt/tasl/main/icon/Hourglass.png" alt="未判定から5分経過" class="ta__timeout-icon">
                        <img src="https://raw.githubusercontent.com/yymmt/tasl/main/icon/Alert.png" alt="注意" class="ta__warning-icon ta__clickable">
                    </span>
                `;
                let onclick = (sel,f) => {
                    query(sel,panel)[0].addEventListener("click",e=>{
                        f();
                        updateSide(elm);
                        saveLocalStorage();
                    });
                }
                onclick(".ta__unsolved-icon",()=>{ ch.isSolved=false; updateIsTimeout(elm); });
                onclick(".ta__solved-icon",()=>{ ch.isSolved=true; ch.isTimeout=false; });
                onclick(".ta__warning-icon",()=>{ ch.isWarning=!ch.isWarning; });
                parent.appendChild(panel);
            }
            let setEnable=(sel, enable)=>{
                query(sel,panel)[0].classList[enable?"remove":"add"]("ta__disabled");
            }
            setEnable(".ta__newcomer-icon",ch.isNewcomer);
            setEnable(".ta__student-icon",!ch.isLastMentor);
            setEnable(".ta__mentor-icon",ch.isLastMentor);
            setEnable(".ta__unsolved-icon",!ch.isSolved);
            setEnable(".ta__solved-icon",ch.isSolved);
            setEnable(".ta__timeout-icon",ch.isTimeout);
            setEnable(".ta__warning-icon",ch.isWarning);
            query(".ta__mentor-name",panel)[0].textContent=ch.mentor.replace(/mentor-/,"");
        }
    }
    let updateSideAll = () => {
        let elms = query(".p-channel_sidebar__name");
        for(let elm of elms) {
            updateSide(elm);
        }
    }
    let updateIsTimeout = elm => {
        let cn=elm.textContent;
        let ch=data[cn];
        if(ch) {
            ch.isTimeout=ch.isSolved?false : (new Date().getTime()/1000  - ch.ts) > 5*60;
        }
    }

    let obsMessage;
    let obsMessageElm;
    let obsMessageFunc = async (records) => {
        let channelNameElm = query(".p-channel_sidebar__channel--selected .p-channel_sidebar__name")[0];
        let cn=channelNameElm.textContent;
        if(!cn.match(/質問/)) { return; }
        let elms=query(".p-message_pane_message__message")
            .filter(e=>query("[data-message-sender]",e)[0] && query("[data-ts]",e)[0]);
        if(elms.length) {
            let ts=e=>parseFloat(query("[data-ts]",e)[0].getAttribute("data-ts"));
            let sender=e=>e?query("[data-message-sender]",e)[0].textContent:"";
            let elm=elms[elms.length-1]; // 最新のメッセージ
            let mentorElms=elms.filter(e=>query("[data-message-sender]",e)[0].textContent.startsWith("mentor"));
            let mentorElm=mentorElms.length?mentorElms[mentorElms.length-1]:null; // メンターが送った最新のメッセージ
            let ch=digCh(cn);
            let updated=false;
            if(mentorElm && ch.mentorts<ts(mentorElm)) {
                ch.mentor=sender(mentorElm);
                ch.mentorts=ts(mentorElm);
                updated=true;
            }
            if(ch.ts<ts(elm)) {
                ch.ts=ts(elm);
                ch.sender=sender(elm);
                updated=true;
            }
            if(updated) {
                ch.isLastMentor=(elm==mentorElm);
                ch.isSolved=false;
                let getTimeKbn = ts => {
                    let d=new Date(ts*1000);
                    let h=d.getHours();
                    return d.toLocaleDateString("ja-JP", {year: "numeric",month: "2-digit",day: "2-digit"}) + " " + (h<15?0 : h<19?1 : h<23?2 : 3);
                }
                ch.isNewcomer=(ch.mentorts==0 || getTimeKbn(ch.ts)!=getTimeKbn(ch.mentorts));
                updateIsTimeout(channelNameElm);
                updateSide(channelNameElm);
                saveLocalStorage();
            }
        }
    };
    let obsSide;
    let obsSideElm;
    let obsSideFunc = records => {
        updateSideAll();
    };
    setInterval(() => {
        if(obsMessageElm != document.querySelector('.p-message_pane [data-qa="slack_kit_list"]')) {
            obsMessageElm = document.querySelector('.p-message_pane [data-qa="slack_kit_list"]');
            if(obsMessage) {
                obsMessage.disconnect();
            }
            obsMessage = new MutationObserver(obsMessageFunc);
            obsMessage.observe(obsMessageElm, {childList:true})
        }
        if(obsSideElm != document.querySelector('[aria-describedby="channel_sidebar_summary"]')) {
            obsSideElm = document.querySelector('[aria-describedby="channel_sidebar_summary"]');
            if(obsSide) {
                obsSide.disconnect();
            }
            obsSide = new MutationObserver(obsSideFunc);
            obsSide.observe(obsSideElm, {childList:true})
        }

        let elms = query(".p-channel_sidebar__name");
        for(let elm of elms) {
            updateIsTimeout(elm);
            updateSide(elm);
        }
    }, 3000); // たまにオブザーバー外れてしまうので定期的につける
    await wait(3000);
    init();
    updateSideAll();
})();

