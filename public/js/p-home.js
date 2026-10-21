/* 首頁：「今天的展櫃」從幾個朝代各抽一件有照片的文物。 */
Mu.boot(async function (meta) {
  const { esc, el, shuffle } = Mu;
  const box = document.getElementById("today");
  const groups = shuffle(Mu.GROUPS.map((g) => g.id).filter((g) => meta.pool[g] >= 5)).slice(0, 8);
  try {
    const lists = await Promise.all(groups.map((g) => Mu.pool({ grp: g, k: 4 })));
    lists.map((l) => shuffle(l)[0]).filter(Boolean)
      .sort((a, b) => Mu.GROUP[a.grp].order - Mu.GROUP[b.grp].order)
      .forEach((it) => {
        const a = el('<a class="acard" href="' + Mu.artifactPage(it) + '"><span class="pic"></span><div class="info"><b>' + esc(it.name) + "</b><small>" +
          esc(Mu.gname(it.grp) + "・" + it.catInfo.name) + "</small></div></a>");
        a.querySelector(".pic").replaceWith(Mu.photo(it));
        box.appendChild(a);
      });
  } catch (e) {
    console.error(e);
    box.replaceWith(el('<p class="lead">展櫃暫時打不開，請到<a href="/artifact">文物小百科</a>看看。</p>'));
  }
});
