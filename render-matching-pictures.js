/* ---------- MATCHING WITH PICTURES ---------- */
function renderMatchingPicturesSection(section) {
    const wrapper = document.createElement("div");
    wrapper.className = "matching-section";
    wrapper.innerHTML = `<h2>${section.title}</h2><p>${section.instructions}</p>`;
  
    section.prompts.forEach((q, idx) => {
      const row = document.createElement("div");
      row.className = "prompt-row";
  
      // Image + caption
      const media = document.createElement("div");
      media.className = "prompt-media";
      media.innerHTML = `
        <img src="${state.selectedCourse}/${q.image}" alt="Prompt ${idx + 1}" class="prompt-image"/>
        <div class="prompt-caption">${q.question}</div>
      `;
  
      // Dropdown
      const selectWrapper = document.createElement("div");
      selectWrapper.className = "answer-select";
  
      const select = document.createElement("select");
      select.innerHTML = `<option value="">-- Select --</option>` +
        section.word_bank.map(opt => `<option value="${opt.text}">${opt.text}</option>`).join("");
  
      select.addEventListener("change", () => {
        state.answers[`matching_pictures-${section._sectionIndex}-${idx}`] = select.value;
      });
  
      selectWrapper.appendChild(select);
      row.appendChild(media);
      row.appendChild(selectWrapper);
      wrapper.appendChild(row);
    });
  
    return wrapper;
  }
  