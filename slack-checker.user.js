// ==UserScript==
// @name         Slack見落としチェッカー
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  try to take over the world!
// @author       You
// @match        https://app.slack.com/client/T02CXU5S59P/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=slack.com
// @grant        none
// @updateURL    https://raw.githubusercontent.com/yymmt/tasl/main/slack-checker.user.js
// @downloadURL  https://raw.githubusercontent.com/yymmt/tasl/main/slack-checker.user.js
// ==/UserScript==
// @see          アイコン素材 : http://www.small-icons.com/packs/24x24-free-application-icons.htm

let wait = async(t) => await new Promise(resolve => setTimeout(resolve, t));
(async function () {
    let addShortCut = (ctrlKey, shiftKey, altKey, code, f) => {
        document.addEventListener("keydown", async (e) => {
            if(e.ctrlKey == ctrlKey && e.shiftKey == shiftKey && e.altKey == altKey && e.code.toLowerCase() == code.toLowerCase()) {
                await f();
            }
        });
    }
    let query = (selector,elm=document) => Array.from(elm.querySelectorAll(selector));
    let summary=document.createElement("div");
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
            .ta__other-time-kbn {
                opacity:0.5;
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
            .ta__summary {
                position: absolute;
                top: 3px;
                right: 3px;
                background: white;
                font-size: 12px;
                z-index: 100;
                padding: 4px;
                border-radius: 4px;
                border: 1px solid lightgray;
                transition: 0.5s all ease;
                min-width: 160px;
            }
            .ta__summary.ta__hide {
                transform: translateY(calc(-100% + 4px));
            }
            .ta__summary h6 {
                font-size: 100%;
                font-weight: bold;
            }
            .ta__summary ul {
                list-style: none;
                margin-left: 20px;
                margin-bottom: 0;
            }
            .ta__summary li {
                margin-bottom: 0;
                position: relative;
            }
            .ta__summary li .ta__remove-line {
                position: absolute;
                right: 0px;
                top: 0px;
                cursor: pointer;
            }
            .ta__summary img {
                width: 12px;
            }
            .ta__hide-button {
                position: absolute;
                right: 0px;
                top: 0px;
                padding: 0px 6px;
                cursor: pointer;
            }
        `;
        document.body.append(stl);
        summary.classList.add("ta__summary");
        summary.innerHTML=`
            <h6>課題レビュー残<small class='ta__summary__review-left-mintime'></small></h6>
            <div class='ta__summary__review-left'></div>
            <span class="ta__hide-button">×</span>
        `;
        summary.addEventListener("click", e=>{
            if(summary.classList.contains("ta__hide")) {
                summary.classList.remove("ta__hide");
            }
        });
        query(".ta__hide-button",summary)[0].addEventListener("click", e=>{
            summary.classList.add("ta__hide");
            e.stopPropagation();
        });
        document.body.append(summary);
    }

    let data = localStorage.getItem("techacademy-senderchecker");
    data = data ? JSON.parse(data) : {};
    let reviewData = {};
    let reviewUrlPrefix="https://techacademy.jp/mentor/reports/";
    let iconUrlPrefix="https://raw.githubusercontent.com/yymmt/tasl/main/icon/";
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
                    <img src="${iconUrlPrefix}Exit.png" class="ta__newcomer-icon">
                    <img src="${iconUrlPrefix}People.png" class="ta__student-icon">
                    <img src="${iconUrlPrefix}Boss.png" class="ta__mentor-icon">
                    <span class="ta__mentor-name"></span>
                    <img src="${iconUrlPrefix}Question.png" class="ta__unsolved-icon ta__clickable">
                    <img src="${iconUrlPrefix}Apply.png" class="ta__solved-icon ta__clickable">
                    <span class="ta__small-icons">
                        <img src="${iconUrlPrefix}Hourglass.png" class="ta__timeout-icon">
                        <img src="${iconUrlPrefix}Alert.png" class="ta__warning-icon ta__clickable">
                    </span>
                `;
                let onclick = (sel,f) => {
                    query(sel,panel)[0].addEventListener("click",e=>{
                        updateSideAndSaveIfChange(elm,ch,f);
                    });
                }
                onclick(".ta__unsolved-icon",()=>{ ch.isSolved=false; updateIsTimeout(ch); });
                onclick(".ta__solved-icon",()=>{ ch.isSolved=true; updateIsTimeout(ch); });
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
            elm.classList[ch.isOtherTimeKbn?"add":"remove"]("ta__other-time-kbn");
            query(".ta__mentor-name",panel)[0].textContent=ch.mentor.replace(/mentor-/,"");
        }
    }
    let updateSideAndSaveIfChange = (elm,ch,f) => {
        let bk={...ch};
        f();
        if(Object.keys(ch).some(k=>ch[k]!=bk[k])) {
            if(elm) { updateSide(elm); }
            saveLocalStorage();
            updateSummary();
        }
    }
    let updateSideAll = () => {
        let elms = query(".p-channel_sidebar__name");
        for(let elm of elms) {
            updateSide(elm);
        }
        updateSummary();
    }
    let updateIsTimeout = ch => {
        ch.isTimeout=ch.isSolved?false : (new Date().getTime()/1000  - ch.ts) > 5*60;
    }
    let getTimeKbn = ts => {
        let d=new Date(ts*1000);
        let h=d.getHours();
        return d.toLocaleDateString("ja-JP", {year: "numeric",month: "2-digit",day: "2-digit"}) + " " + (h<15?0 : h<19?1 : h<23?2 : 3);
    }
    let isTooOld = ts => new Date().getTime()/1000 - ts > 60*60*24;
    let updateSummary = () => {
        let tsToHhmm = ts => (new Date(ts*1000)).toLocaleTimeString("ja-JP").replace(/:\d+$/,"");

        let leftReview=[];
        let mintime=2145711600; // ← 2037-12-30 00:00:00
        for(let repid of Object.keys(reviewData)) {
            let rv = reviewData[repid];
            if(rv.isRemoved) continue;
            if(mintime>rv.ts) mintime=rv.ts;
            if(!rv.mentor) {
                leftReview.push(rv);
            }
        }

        let elm=query(".ta__summary__review-left")[0];
        elm.innerHTML='';
        if(leftReview.length) {
            let rep=new RegExp("([\\d_\\s]|質問)","g");
            let alert = student => Object.keys(data).some(cn=>cn.replace(rep,"") == student.replace(rep,"") && data[cn].isWarning)?`<img src="${iconUrlPrefix}Alert.png">`:"";
            let e=document.createElement("ul");
            e.innerHTML=leftReview.map(rv=>`
                <li data-repid='${rv.repid}'><a href='${reviewUrlPrefix}${rv.repid}' target='review'>${rv.student}</a>${alert(rv.student)}<span class="ta__remove-line">×</span></li>
            `).join("");
            query(".ta__remove-line",e).forEach(r=>{
                r.addEventListener("click", eve=>{
                    let repid=eve.target.parentElement.getAttribute("data-repid");
                    reviewData[repid].isRemoved=true;
                    updateSummary();
                });
            })
            elm.append(e);
            query(".ta__summary__review-left-mintime")[0].textContent=`(${tsToHhmm(mintime)}以降)`;
        } else if(!Object.keys(reviewData).length) {
            elm.innerHTML='<ul><li>未判定<small>(alertチャンネルを開いてください)</small></li></ul>';
            query(".ta__summary__review-left-mintime")[0].textContent=``;
        } else {
            elm.innerHTML=`<ul>
                <li><small><a href='https://techacademy.jp/mentor/all/reports?utf8=%E2%9C%93&courses%5B%5D=first-sidejob&courses%5B%5D=web-production-mom&courses%5B%5D=first-sidejob-oneonone-plan&commit=%E3%82%B3%E3%83%BC%E3%82%B9%E3%82%92%E7%B5%9E%E3%82%8A%E8%BE%BC%E3%82%80' target='review'>全期間を確認</a></small></li>
            </ul>`;
            query(".ta__summary__review-left-mintime")[0].textContent=`(なし)`;
        }
    }

    let obsMessage;
    let obsMessageElm;
    let obsMessageFunc = async (records) => {
        let channelNameElm = query(".p-channel_sidebar__channel--selected .p-channel_sidebar__name")[0];
        let cn=channelNameElm.textContent;
        if(cn.match(/質問/)) {
            let elms=query(".p-message_pane_message__message")
                .filter(e=>query("[data-message-sender]",e)[0] && !query("[data-message-sender]",e)[0].textContent.includes("support") && query("[data-ts]",e)[0] && query(".c-message_kit__blocks",e)[0]);
            if(elms.length) {
                let ts=e=>parseFloat(query("[data-ts]",e)[0].getAttribute("data-ts"));
                let sender=e=>e?query("[data-message-sender]",e)[0].textContent:"";
                let elm=elms[elms.length-1]; // 最新のメッセージ
                let mentorElms=elms.filter(e=>query("[data-message-sender]",e)[0].textContent.startsWith("mentor"));
                let mentorElm=mentorElms.length?mentorElms[mentorElms.length-1]:null; // メンターが送った最新のメッセージ
                if(!isTooOld(ts(elm))) {
                    let ch=digCh(cn);
                    updateSideAndSaveIfChange(channelNameElm,ch,()=>{
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
                            ch.isNewcomer=(ch.mentorts==0 || getTimeKbn(ch.ts)!=getTimeKbn(ch.mentorts));
                            updateIsTimeout(ch);
                        }
                    });
                }
            }
        } else {
            let elms=query(".p-message_pane_message__message")
                .filter(e=>query("[data-ts]",e)[0] && query(".p-rich_text_section",e)[0]);
            let ts=e=>parseFloat(query("[data-ts]",e)[0].getAttribute("data-ts"));
            for(let elm of elms) {
                let match=query(".p-rich_text_section",elm)[0].textContent.match(/(.*)さんの課題のステータスがレビュー中.*reports\/(\d+)/);
                if(match) {
                    let [m,student,repid] = match;
                    reviewData[repid] = Object.assign(reviewData[repid]||{},{student,mentor:'DUMMY',ts:ts(elm),repid});
                }
                match=query(".p-rich_text_section",elm)[0].textContent.match(/(.*)さんが.*提出.*reports\/(\d+)/);
                if(match) {
                    let [m,student,repid] = match;
                    reviewData[repid] = Object.assign(reviewData[repid]||{},{student,ts:ts(elm),repid});
                }
            }
            updateSummary();
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

        for(let cn of Object.keys(data)) {
            let ch=data[cn];
            if(!ch.isWarning && isTooOld(ch.ts)) {
                delete data[cn];
                let elm=query(".p-channel_sidebar__name").filter(e=>e.textContent==cn)[0];
                if(elm) {
                    query(".ta__channel-panel",elm.parentElement)[0].remove();
                }
            }
        }

        let k=getTimeKbn(new Date().getTime()/1000);
        for(let cn of Object.keys(data)) {
            let ch=data[cn];
            let elm=query(".p-channel_sidebar__name").filter(e=>e.textContent==cn)[0];
            updateSideAndSaveIfChange(elm,ch,()=>{
                updateIsTimeout(ch);
                ch.isOtherTimeKbn=(k!=getTimeKbn(ch.ts));
            });
        }
    }, 3000); // たまにオブザーバー外れてしまうので定期的につける
    await wait(3000);
    init();
    updateSideAll();

    let toggleStar = async () => {
        document.querySelector(".p-view_header__channel_title").click();
        await wait(500);
        document.querySelector(".p-about_modal__header .c-icon--star, .p-about_modal__header .c-icon--star-o").click();
        await wait(200);
        document.querySelector("[data-qa='sk_close_modal_button']").click();
    }
    let openUrl = () => {
        let url=document.querySelector(".p-classic_nav__model__title__info__topic__text a").href;
        window.open(url, "student");
    }
    addShortCut(true, false, false, "keys", toggleStar);
    addShortCut(true, false, false, "keyu", openUrl);
})();

