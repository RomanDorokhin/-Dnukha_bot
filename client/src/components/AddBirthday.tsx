import React, { useState } from 'react';

const AddBirthday = () => {
  const [relation, setRelation] = useState('знакомый');

  const relations = ['друг', 'коллега', 'знакомый', 'родственник'];

  return (
    <div className="add-screen">
      <h2>Добавить день рождения</h2>
      <div className="relation-selector">
        {relations.map(r => (
          <button 
            key={r} 
            className={relation === r ? 'active' : ''} 
            onClick={() => setRelation(r)}
          >
            {r}
          </button>
        ))}
      </div>
      
      <div className="ai-section">
        <button>Сгенерировать ИИ</button>
        {/* Result card with "Use" and "Another" buttons */}
      </div>
    </div>
  );
};

export default AddBirthday;
